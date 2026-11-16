# DSH Personal Assistant

A voice assistant plugin for DeepSeek Harness (DSH). Call a Telegram account and talk, or let the assistant call you when a task needs your answer or has finished. Whatever you ask for becomes a DSH session, tracked on a task board in the sidebar.

```
You <-> Telegram call <-> gateway (py-tgcalls) <-> LiveKit room <-> voice agent <-> DSH
```

- **Inbound.** You phone the assistant's Telegram account. When you hang up, the to-dos you gave are extracted and handed to a fresh DSH session.
- **Outbound.** The assistant phones you when a task needs your confirmation, finishes, or fails (you choose which). A "Call me" button on the board rings you on demand.
- **Task board.** Sidebar entry "Personal Assistant": in progress, needs you, done, not finished. Click a card to open its session.
- **Guard rails.** Only allow-listed Telegram ids can call or be called. Automatic calls respect quiet hours, a minimum interval, a daily cap, and a ring timeout. Missed calls retry a set number of times.

## Requirements

- DSH with the Web GUI.
- A [LiveKit Cloud](https://cloud.livekit.io) project (the voice models run on LiveKit Inference).
- A spare Telegram **user** account (see the warning below) and its `api_id` / `api_hash` from <https://my.telegram.org>.
- Node.js 20+, npm, and Python 3.10+ on the machine that runs DSH.

> The gateway signs in as a normal Telegram user, not a bot, because bots cannot place or answer calls. Telegram may restrict accounts used this way. Use a dedicated account, never your main one.

## Install

1. Install the bundle from this directory (Plugin Manager, or `install_bundle` with the absolute path). In the [dsh-life-panels](../../README.md) repository run `node scripts/build.mjs` first; it writes `client.js` from `src/client.js`. With the ElansStack plugin installed, the board appears as the "语音助手 / Assistant" tab instead of its own sidebar icon.
2. Store these credentials in the DSH credential store or the environment:

   | Name | Value |
   |---|---|
   | `LIVEKIT_URL` | `wss://<project>.livekit.cloud` |
   | `LIVEKIT_API_KEY` | LiveKit API key |
   | `LIVEKIT_API_SECRET` | LiveKit API secret |
   | `DSH_VOICE_BRIDGE_TOKEN` | any long random string, shared by DSH and the workers |
   | `TG_API_ID` | Telegram api_id |
   | `TG_API_HASH` | Telegram api_hash |

   The names are configurable through the `*Env` settings.
3. Open the plugin settings and put your Telegram numeric user id in **allowedCallers**. An empty list rejects every call and disables outgoing calls.
4. Sign the Telegram account in once, in a terminal. After the first start (step 5 creates the environment), run:

   ```
   ~/.dsh/personal-assistant/worker/.venv/bin/python ~/.dsh/personal-assistant/worker/telegram_gateway.py --login
   ```

   Enter the phone number and the code Telegram sends. The login is saved as `~/.dsh/personal-assistant/worker/<telegramSession>.session`; keep that file private.
5. The plugin installs the worker dependencies on first start, then runs the voice agent and the gateway for you (`autoStart`). Open the sidebar entry; the pill at the top turns green when both run. The first start takes a minute while `npm install` and `pip install` run. Progress and errors show in the System tab.

## Using it

- **Call in.** From an allowed Telegram account, call the assistant's account. In Telegram's privacy settings, allow calls from that account.
- **Call out.** Press **Call me** on the board, or let task events trigger it (`callOn`). The briefing covers the tasks that triggered the call and the current board. If you answer a task that was waiting, the assistant passes your answer to that session.
- **After the call.** Hang up and the to-dos appear as a task within seconds.

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `allowedCallers` | `[]` | Telegram user ids allowed to call, and to be called |
| `callbackUser` | first allowed caller | Who the assistant phones |
| `assistantName` | `Lucy` | Name the assistant uses |
| `language` | `zh` | `zh` or `en`: speech recognition, voice, persona |
| `extraInstructions` | empty | Extra rules appended to the assistant's prompt |
| `callOn` | `waiting`, `done` | Task events that trigger a call: `waiting`, `done`, `failed` |
| `quietHours` | `23:00-08:00` | No automatic calls in this local window; empty disables |
| `minCallIntervalMinutes` | `10` | Minimum gap between automatic calls |
| `maxCallsPerDay` | `6` | Automatic calls per 24 h; `0` turns them off |
| `ringTimeoutSeconds` | `45` | How long the phone rings |
| `retries` | `1` | Extra attempts after a missed or busy call, 2 minutes apart |
| `autoStart` | `true` | Run the workers with the plugin |
| `sttModel`, `llmModel`, `ttsModel`, `ttsVoice` | see Settings | LiveKit Inference models |
| `workspacePath`, `agentPreset` | empty | Working directory and preset for task sessions |
| `telegramSession`, `agentName` | `dsh-voice` | Session file name and LiveKit agent name |
| `nodePath`, `npmPath`, `pythonPath` | empty | Set when the tools are not on `PATH` |
| `*Env` | credential names above | Rename the credential refs |

Several finished tasks within a short time are merged into one call. The "Call me" button ignores quiet hours and the limits.

## Safety notes

- The assistant cannot approve DSH permission prompts. Task sessions run under your default DSH permissions. The task prompt asks the session to stop and ask before spending money, messaging other people, or deleting data. That is an instruction to the model, not a permission rule. If tasks can do real damage, set `agentPreset` to a stricter preset.
- The workers authenticate to the control API under `/livekit-telegram/api` with the bridge token. The board, status and "Call me" routes only answer same-machine requests from the DSH page; requests that came through a proxy or tunnel are refused.
- Phone numbers are masked in logs. The Telegram session file and the credential store are written with mode 600.
- Call audio passes through LiveKit Cloud and its inference providers. Do not use the assistant for conversations you would not send to a cloud speech service.

## Where files live

Everything the plugin writes is under `~/.dsh/personal-assistant/` (or `$DSH_HOME/personal-assistant/`): the task board, outgoing-call history, and the `worker/` directory with the Python venv, `node_modules`, and the Telegram login. Upgrading or reinstalling the plugin does not touch it. Delete the directory to start fresh.

## Troubleshooting

| Symptom | Check |
|---|---|
| Pill stays red | The System tab shows which worker fails and why (missing credential, tool not found, login needed) |
| "Telegram login required" | Run the `--login` command from step 4 |
| Call connects but no voice | Read the agent log in the System tab; confirm the LiveKit key and that Inference is enabled for the project |
| "Call me" is greyed out | `allowedCallers` is empty, or the workers are not both running |
| Outgoing call never rings | The two accounts should have chatted before; Telegram may refuse to call strangers |
| No call after a task finished | Quiet hours, the minimum interval, the daily cap, or `callOn` held it back. The Calls tab says which |

## Development

```
npm install
npm test
```

The host side is plain ES modules (`index.js`, `lib/`), the page is `client.js`, and `worker/` holds the LiveKit agent (`agent.js`) and the Telegram gateway (`telegram_gateway.py`). The plugin copies the worker files into the data directory at start, so edits take effect on the next plugin restart.

## License

MIT
