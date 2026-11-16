import { fileURLToPath } from 'node:url';
import { ServerOptions, cli, defineAgent, inference, llm, voice } from '@livekit/agents';
import { z } from 'zod';

const BASE = (process.env.DSH_BASE_URL ?? 'http://127.0.0.1:3080').replace(/\/$/, '');
const TOKEN = process.env.DSH_VOICE_BRIDGE_TOKEN ?? '';
const AGENT_NAME = process.env.AGENT_NAME ?? 'dsh-voice';
const NAME = process.env.ASSISTANT_NAME || 'Lucy';
const LANG = process.env.ASSISTANT_LANGUAGE === 'en' ? 'en' : 'zh';
const EXTRA = (process.env.EXTRA_INSTRUCTIONS ?? '').trim();
const STT_MODEL = process.env.STT_MODEL || 'deepgram/nova-3';
const LLM_MODEL = process.env.LLM_MODEL || 'google/gemma-4-31b-it';
const TTS_MODEL = process.env.TTS_MODEL || 'cartesia/sonic-3';
const TTS_VOICE = process.env.TTS_VOICE || '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc';
const POLL_MS = 1500;
const WAIT_LIMIT_MS = 45_000;

async function bridge(path, room, body = {}) {
  const response = await fetch(`${BASE}/livekit-telegram/api/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ room, ...body }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? `bridge ${path} failed with ${response.status}`);
  return data;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function tools(room) {
  return [
    llm.tool({
      name: 'ask_dsh',
      description:
        'Send a request to the DSH coding agent and wait for its answer. Use it for anything about the user\'s code, files, ' +
        'commands or projects. Pass the request as a complete self-contained instruction. Returns the answer, or a still-running notice.',
      parameters: z.object({ request: z.string().describe('What DSH should do, in the user\'s words.') }),
      execute: async ({ request }) => {
        await bridge('send', room, { text: request });
        const deadline = Date.now() + WAIT_LIMIT_MS;
        while (Date.now() < deadline) {
          await sleep(POLL_MS);
          const result = await bridge('reply', room);
          if (result.state === 'done') return result.reply || 'DSH finished without a text answer.';
          if (result.state === 'failed') return `DSH stopped (${result.reason}). ${result.reply ?? ''}`.trim();
        }
        return 'DSH is still working. Tell the user in Chinese, and call check_dsh in a moment.';
      },
    }),
    llm.tool({
      name: 'check_dsh',
      description: 'Check whether the previous DSH request has finished and read its answer.',
      parameters: z.object({}),
      execute: async () => {
        const result = await bridge('reply', room);
        if (result.state === 'running') return 'DSH is still working.';
        if (result.state === 'no-session') return 'No request has been sent yet.';
        return result.reply || `DSH ${result.state}.`;
      },
    }),
    llm.tool({
      name: 'reply_to_task',
      description:
        'Pass the user\'s answer to a background task that is waiting for confirmation. Use the task number from the briefing. ' +
        'Only call it after the user has clearly given the answer.',
      parameters: z.object({
        number: z.number().int().describe('Task number from the briefing.'),
        answer: z.string().describe('The user\'s answer, in their words.'),
      }),
      execute: async ({ number, answer }) => {
        await bridge('tasks/reply', room, { n: number, text: answer });
        return 'Sent to the task.';
      },
    }),
    llm.tool({
      name: 'cancel_dsh',
      description: 'Stop the DSH request that is currently running.',
      parameters: z.object({}),
      execute: async () => {
        await bridge('cancel', room);
        return 'Cancelled.';
      },
    }),
  ];
}

const PERSONA = {
  zh: `你是 ${NAME},用户的私人助理,负责管理用户所有的生活事务。
语言:全程只说简体中文,即使用户夹杂英文也用中文回答。技术名词、人名、文件名可保留原文。
说话风格:通过电话交流,口语化、简短、自然,一两句话说清楚;不要用 markdown、列表或符号;数字、日期、路径放慢读,不要朗读长段代码或长文本。
称呼:直接称呼用户为"你",语气亲切可靠,像一位熟悉的助理。
做事方式:用户交代的事情,先用一句话复述确认要点。需要立刻知道结果的简单问题(查一个信息、看一下状态),用 ask_dsh 交给 DSH 并汇报结果;需要花时间的事情,不要在电话里等。信息不够时只追问最关键的一个问题。
诚实:只有 DSH 返回结果后,才可以说事情做完了;不要自己编造已完成的操作。DSH 还在处理时,告诉用户正在进行,稍后用 check_dsh 查看。遇到 DSH 需要权限确认时,告诉用户请在 DSH 应用里点击批准,你不能代为批准。
通话结束后,系统会自动把通话中交代的待办整理出来,交给 DSH 单独开一个会话去执行。所以用户交代需要事后处理的事情时,复述确认,并告诉用户挂断后会自动安排。
边界:涉及花钱、发送消息给他人、删除数据等不可逆操作,必须先口头向用户确认再交给 DSH。`,
  en: `You are ${NAME}, the user's private assistant, looking after all of their everyday affairs.
Language: speak only English.
Style: this is a phone call. Be conversational, short and natural, one or two sentences at a time. No markdown, lists or symbols. Read numbers, dates and paths slowly and never read out long code or text.
How you work: repeat the user's request back in one sentence. For a quick question that needs an answer now, hand it to ask_dsh and report back. For anything that takes time, do not wait on the phone. If information is missing, ask only the single most important question.
Honesty: only say something is done after DSH has returned a result. Never invent actions. If DSH needs a permission approval, tell the user to approve it in the DSH app; you cannot approve for them.
After the call, the system extracts the to-dos from the conversation and hands them to a separate DSH session. When the user gives you something to do later, confirm it and say it will be arranged after hang-up.
Boundaries: anything that spends money, messages other people or deletes data must be confirmed out loud with the user before it goes to DSH.`,
};
const INSTRUCTIONS = PERSONA[LANG] + (EXTRA ? `\n${EXTRA}` : '');

const GREETING = {
  zh: `用一句简短的中文问候用户,说你是 ${NAME},然后问有什么需要处理的。`,
  en: `Greet the user in one short sentence, say you are ${NAME}, and ask what you can take care of.`,
}[LANG];
const OUTGOING_GREETING = {
  zh: '这是你打出去的电话。根据通话背景简短问好,直接说明来意,再等用户回应。',
  en: 'You placed this call. Greet the user briefly based on the call background, state the reason, then wait for them to respond.',
}[LANG];

const EXTRACT_PROMPT =
  `下面是用户与私人助理 ${NAME} 的一通电话记录。请只提取用户明确交代、需要之后去执行的待办事项。` +
  '不要包含闲聊、已经在通话中完成的事,也不要自己添加没说过的事。每条待办写成一句完整、可独立执行的指令,语言与通话一致,保留人名、时间、地点、数字等细节。' +
  '只输出 JSON,格式为 {"title":"一句话概括","todos":["...","..."]};没有待办时 todos 为空数组。\n\n通话记录:\n';

function transcriptOf(history) {
  return history.items
    .filter((item) => item.type === 'message' && (item.role === 'user' || item.role === 'assistant'))
    .map((item) => ({ role: item.role, text: (item.textContent ?? '').trim() }))
    .filter((turn) => turn.text)
    .map((turn) => `${turn.role === 'user' ? '用户' : NAME}:${turn.text}`)
    .join('\n');
}

function parseTodos(text) {
  const match = /\{[\s\S]*\}/.exec(text);
  if (!match) return undefined;
  try {
    const value = JSON.parse(match[0]);
    const todos = Array.isArray(value.todos) ? value.todos.map((t) => String(t).trim()).filter(Boolean) : [];
    return { title: String(value.title ?? '').trim(), todos };
  } catch {
    return undefined;
  }
}

/** After hang-up: turn the conversation into a to-do list and hand it to a fresh DSH session. */
async function handOffTasks(room, history) {
  const transcript = transcriptOf(history);
  if (!transcript.includes('用户:')) return;
  const chatCtx = llm.ChatContext.empty();
  chatCtx.addMessage({ role: 'user', content: EXTRACT_PROMPT + transcript });
  const response = await new inference.LLM({ model: LLM_MODEL }).chat({ chatCtx }).collect();
  const parsed = parseTodos(response.text);
  if (!parsed || parsed.todos.length === 0) return;
  const result = await bridge('tasks/create', room, { title: parsed.title, todos: parsed.todos, transcript });
  console.log(`[lucy] ${parsed.todos.length} to-do item(s) sent to DSH session ${result.sessionId ?? '(duplicate)'}`);
}

export default defineAgent({
  entry: async (ctx) => {
    // ctx.room is not connected yet here, so its name is still empty; the job carries the room name.
    const room = ctx.job.room?.name ?? '';
    const session = new voice.AgentSession({
      stt: new inference.STT({ model: STT_MODEL, language: LANG }),
      llm: new inference.LLM({ model: LLM_MODEL }),
      tts: new inference.TTS({ model: TTS_MODEL, voice: TTS_VOICE, language: LANG }),
      turnHandling: { turnDetection: new inference.TurnDetector() },
    });
    // Hand off once, as soon as the caller leaves; waiting for the room to time out takes about a minute.
    let handedOff;
    const handOff = () => (handedOff ??= handOffTasks(room, session.history).catch((error) => {
      console.error('[lucy] could not hand off to-dos:', error?.message ?? error);
    }));
    ctx.addShutdownCallback(handOff);
    ctx.room.on('participantDisconnected', () => {
      if (ctx.room.remoteParticipants.size === 0) void handOff().then(() => ctx.shutdown('caller left'));
    });
    // An outgoing call carries a briefing (why the assistant is calling); an incoming one has none.
    const call = await bridge('call/briefing', room).catch(() => ({ briefing: '', outgoing: false }));
    const instructions = call.briefing ? `${INSTRUCTIONS}\n\n[Call background]\n${call.briefing}` : INSTRUCTIONS;
    await session.start({
      agent: voice.Agent.create({ instructions, tools: tools(room) }),
      room: ctx.room,
    });
    await ctx.connect();
    session.generateReply({ instructions: call.outgoing ? OUTGOING_GREETING : GREETING });
  },
});

cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url), agentName: AGENT_NAME }));
