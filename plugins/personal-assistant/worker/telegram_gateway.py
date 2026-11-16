"""Telegram <-> LiveKit audio gateway for the DSH voice plugin.

A dedicated Telegram user account receives 1:1 calls (py-tgcalls), the caller's audio
is forwarded into a LiveKit room where the DSH voice agent is dispatched, and the
agent's speech is played back into the Telegram call.
"""
import asyncio
import datetime
import logging
import os
import secrets
import sys
import time
from pathlib import Path

import aiohttp
from livekit import api, rtc
from pyrogram import Client
from pytgcalls import PyTgCalls, idle
from pytgcalls import filters as fl
from pytgcalls.exceptions import CallBusy, CallDeclined, CallDiscarded, TimedOutAnswer
from pytgcalls.types import CallConfig, ChatUpdate, Device, Direction, ExternalMedia
from pytgcalls.types import MediaStream, RecordStream, StreamFrames
from pytgcalls.types.raw import AudioParameters


def load_env(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        os.environ.setdefault(key.strip(), value.strip())


load_env(Path(__file__).with_name('.env'))

LOGIN_ONLY = '--login' in sys.argv
if LOGIN_ONLY:  # only the Telegram credentials are needed to create the login session
    for _name in ('TG_API_ID', 'TG_API_HASH'):
        if not os.environ.get(_name):
            os.environ[_name] = input(f'{_name}: ').strip()


def _need(name: str) -> str:
    return os.environ.get(name, '') if LOGIN_ONLY else os.environ[name]


LIVEKIT_URL = _need('LIVEKIT_URL')
LIVEKIT_API_KEY = _need('LIVEKIT_API_KEY')
LIVEKIT_API_SECRET = _need('LIVEKIT_API_SECRET')
DSH_BASE_URL = os.environ.get('DSH_BASE_URL', 'http://127.0.0.1:3080').rstrip('/')
BRIDGE_TOKEN = _need('DSH_VOICE_BRIDGE_TOKEN')
AGENT_NAME = os.environ.get('AGENT_NAME', 'dsh-voice')
TG_API_ID = int(os.environ['TG_API_ID'])
TG_API_HASH = os.environ['TG_API_HASH']
TG_SESSION = os.environ.get('TG_SESSION', 'dsh-voice')

SAMPLE_RATE = 48000
CHANNELS = 1
FRAME_MS = 10
FRAME_BYTES = SAMPLE_RATE * 2 * CHANNELS * FRAME_MS // 1000  # PCM16LE
SILENCE = bytes(FRAME_BYTES)
AUDIO_PARAMS = AudioParameters(bitrate=SAMPLE_RATE, channels=CHANNELS)
OUTBOUND_POLL_SECONDS = 5

log = logging.getLogger('dsh-telegram-gateway')

app = Client(
    TG_SESSION,
    api_id=TG_API_ID,
    api_hash=TG_API_HASH,
    workdir=str(Path(__file__).parent),
)
call_py = PyTgCalls(app)
sessions: dict[int, 'CallSession'] = {}


async def bridge(path: str, body: dict) -> dict:
    async with aiohttp.ClientSession() as http:
        async with http.post(
            f'{DSH_BASE_URL}/livekit-telegram/api/{path}',
            json=body,
            headers={'authorization': f'Bearer {BRIDGE_TOKEN}'},
            timeout=aiohttp.ClientTimeout(total=15),
        ) as response:
            data = await response.json(content_type=None)
            if response.status >= 400:
                raise RuntimeError(f'bridge {path}: {data}')
            return data


def room_token(room: str, user_id: int) -> str:
    return (
        api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        .with_identity(f'tg-{user_id}')
        .with_name('Telegram caller')
        .with_ttl(datetime.timedelta(minutes=30))
        .with_grants(api.VideoGrants(room_join=True, room=room, can_publish=True, can_subscribe=True))
        .with_room_config(api.RoomConfiguration(agents=[api.RoomAgentDispatch(agent_name=AGENT_NAME)]))
        .to_jwt()
    )


class CallSession:
    def __init__(self, chat_id: int, outbound_id: str | None = None):
        self.chat_id = chat_id
        self.outbound_id = outbound_id
        self.room_name = f'tg-{chat_id}-{secrets.token_hex(4)}'
        self.room = rtc.Room()
        self.source = rtc.AudioSource(SAMPLE_RATE, CHANNELS)
        self.outbound: asyncio.Queue[bytes] = asyncio.Queue(maxsize=3000)  # ~30 s of 10 ms frames
        self.tasks: list[asyncio.Task] = []
        self.closed = False

    async def _join_room(self) -> None:
        self.room.on('track_subscribed', self._on_track)
        self.room.on('disconnected', lambda *_: asyncio.ensure_future(self.close()))
        await self.room.connect(LIVEKIT_URL, room_token(self.room_name, self.chat_id))
        track = rtc.LocalAudioTrack.create_audio_track('telegram-caller', self.source)
        await self.room.local_participant.publish_track(
            track, rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE)
        )

    async def start(self) -> None:
        """Incoming call: join the room first so the agent is ready, then accept the call."""
        await self._join_room()
        # Accept the call with an external (frame-fed) audio source, then record the caller.
        await call_py.play(self.chat_id, MediaStream(ExternalMedia.AUDIO, AUDIO_PARAMS))
        await call_py.record(self.chat_id, RecordStream(audio=True, audio_parameters=AUDIO_PARAMS))
        self.tasks.append(asyncio.create_task(self._pump_outbound()))

    async def dial(self, ring_timeout: int) -> None:
        """Outgoing call: ring first and bring the agent in only once the user picks up."""
        await call_py.play(
            self.chat_id,
            MediaStream(ExternalMedia.AUDIO, AUDIO_PARAMS),
            CallConfig(timeout=ring_timeout),
        )
        await self._join_room()
        await call_py.record(self.chat_id, RecordStream(audio=True, audio_parameters=AUDIO_PARAMS))
        self.tasks.append(asyncio.create_task(self._pump_outbound()))

    def push_caller_audio(self, data: bytes) -> None:
        if self.closed or not data:
            return
        frame = rtc.AudioFrame(data, SAMPLE_RATE, CHANNELS, len(data) // (2 * CHANNELS))
        asyncio.ensure_future(self.source.capture_frame(frame))

    def _on_track(self, track: rtc.Track, publication, participant) -> None:
        if track.kind == rtc.TrackKind.KIND_AUDIO and not participant.identity.startswith('tg-'):
            self.tasks.append(asyncio.create_task(self._read_agent_audio(track)))

    async def _read_agent_audio(self, track: rtc.Track) -> None:
        stream = rtc.AudioStream(track, sample_rate=SAMPLE_RATE, num_channels=CHANNELS)
        pending = b''
        async for event in stream:
            pending += bytes(event.frame.data)
            while len(pending) >= FRAME_BYTES:
                chunk, pending = pending[:FRAME_BYTES], pending[FRAME_BYTES:]
                try:
                    self.outbound.put_nowait(chunk)
                except asyncio.QueueFull:
                    pass  # drop rather than let latency grow without bound

    async def _pump_outbound(self) -> None:
        """Send one 10 ms frame per tick; fill gaps with silence so the stream stays continuous."""
        next_tick = time.monotonic()
        while not self.closed:
            try:
                chunk = self.outbound.get_nowait()
            except asyncio.QueueEmpty:
                chunk = SILENCE
            try:
                await call_py.send_frame(self.chat_id, Device.MICROPHONE, chunk)
            except Exception:  # call already gone
                await self.close()
                return
            next_tick += FRAME_MS / 1000
            await asyncio.sleep(max(0.0, next_tick - time.monotonic()))

    async def close(self) -> None:
        if self.closed:
            return
        self.closed = True
        sessions.pop(self.chat_id, None)
        for task in self.tasks:
            if task is not asyncio.current_task():
                task.cancel()
        try:
            await self.room.disconnect()
        except Exception:
            pass
        try:
            await call_py.leave_call(self.chat_id)
        except Exception:
            pass
        try:
            await bridge('call/end', {'room': self.room_name, 'userId': self.chat_id})
        except Exception as error:
            log.warning('call/end failed: %s', error)
        log.info('call %s closed', self.room_name)


async def reject(chat_id: int) -> None:
    try:
        await call_py.leave_call(chat_id)
    except Exception as error:
        log.warning('could not discard call: %s', error)


@call_py.on_update(fl.chat_update(ChatUpdate.Status.INCOMING_CALL))
async def on_incoming(_: PyTgCalls, update: ChatUpdate) -> None:
    chat_id = update.chat_id
    if chat_id in sessions or sessions:
        log.info('busy; discarding call from %s', chat_id)
        return await reject(chat_id)
    session = CallSession(chat_id)
    try:
        verdict = await bridge('call/start', {'room': session.room_name, 'userId': chat_id})
        if not verdict.get('allowed'):
            log.info('caller %s not allowed', chat_id)
            return await reject(chat_id)
        sessions[chat_id] = session
        await session.start()
        log.info('call %s answered in room %s', chat_id, session.room_name)
    except Exception:
        log.exception('failed to start call')
        await session.close()


@call_py.on_update(fl.chat_update(ChatUpdate.Status.LEFT_CALL))
async def on_left(_: PyTgCalls, update: ChatUpdate) -> None:
    session = sessions.get(update.chat_id)
    if session:
        await session.close()


def outcome_of(error: Exception) -> str:
    if 'USER_PRIVACY_RESTRICTED' in str(error):
        return 'privacy'
    if isinstance(error, TimedOutAnswer):
        return 'noanswer'
    if isinstance(error, CallBusy):
        return 'busy'
    if isinstance(error, (CallDeclined, CallDiscarded)):
        return 'declined'
    return 'error'


async def place_call(job: dict) -> None:
    """Dial the user for one queued outbound call and report how it ended."""
    chat_id = int(job['userId'])
    session = CallSession(chat_id, job['id'])
    outcome, detail = 'answered', ''
    try:
        verdict = await bridge(
            'call/start', {'room': session.room_name, 'userId': chat_id, 'outboundId': job['id']}
        )
        if not verdict.get('allowed'):
            raise RuntimeError('callee is not in the allow list')
        sessions[chat_id] = session
        try:
            await app.get_users(chat_id)  # makes sure the account knows the peer before dialing
        except Exception as error:
            log.warning('could not resolve %s: %s', chat_id, error)
        await session.dial(int(job.get('ringTimeoutSeconds') or 45))
        log.info('outgoing call %s answered in room %s', chat_id, session.room_name)
    except Exception as error:
        outcome, detail = outcome_of(error), f'{type(error).__name__}: {error}'
        log.warning('outgoing call to %s ended: %s', chat_id, detail)
        await session.close()
    try:
        await bridge('outbound/report', {'id': job['id'], 'outcome': outcome, 'detail': detail})
    except Exception as error:
        log.warning('could not report the call outcome: %s', error)


async def outbound_loop() -> None:
    """Poll the plugin for calls the assistant wants to place; one call at a time."""
    while True:
        await asyncio.sleep(OUTBOUND_POLL_SECONDS)
        if sessions:
            continue
        try:
            job = (await bridge('outbound/claim', {})).get('call')
        except Exception as error:
            log.debug('outbound poll failed: %s', error)
            continue
        if job:
            await place_call(job)


@call_py.on_update(fl.stream_frame(Direction.INCOMING, Device.MICROPHONE))
async def on_frames(_: PyTgCalls, update: StreamFrames) -> None:
    session = sessions.get(update.chat_id)
    if session and update.frames:
        session.push_caller_audio(update.frames[0].frame)


async def main() -> None:
    await call_py.start()
    poller = asyncio.create_task(outbound_loop())
    try:
        await idle()
    finally:
        poller.cancel()


async def login() -> None:
    async with app:
        me = await app.get_me()
        print(f'Logged in as {me.first_name} (id {me.id}). Session saved; you can close this.')


if __name__ == '__main__':
    if LOGIN_ONLY:
        asyncio.get_event_loop().run_until_complete(login())
        raise SystemExit(0)
    logging.basicConfig(level=logging.WARNING)
    log.setLevel(logging.INFO)
    call_py.loop.run_until_complete(main())
