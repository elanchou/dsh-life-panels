/** Every setting with its default; the Schema below documents the same fields for the Settings UI. */
export const DEFAULTS = {
  autoStart: true,
  allowedCallers: [],
  callbackUser: '',
  assistantName: 'Lucy',
  language: 'zh',
  extraInstructions: '',
  agentName: 'dsh-voice',
  sttModel: 'deepgram/nova-3',
  llmModel: 'google/gemma-4-31b-it',
  ttsModel: 'cartesia/sonic-3',
  ttsVoice: '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc',
  workspacePath: '',
  agentPreset: '',
  callOn: ['waiting', 'done'],
  quietHours: '23:00-08:00',
  minCallIntervalMinutes: 10,
  maxCallsPerDay: 6,
  ringTimeoutSeconds: 45,
  retries: 1,
  telegramSession: 'dsh-voice',
  nodePath: '',
  npmPath: '',
  pythonPath: '',
  livekitUrlEnv: 'LIVEKIT_URL',
  livekitApiKeyEnv: 'LIVEKIT_API_KEY',
  livekitApiSecretEnv: 'LIVEKIT_API_SECRET',
  bridgeTokenEnv: 'DSH_VOICE_BRIDGE_TOKEN',
  telegramApiIdEnv: 'TG_API_ID',
  telegramApiHashEnv: 'TG_API_HASH',
};

export const CALL_EVENTS = ['waiting', 'done', 'failed'];

const text = (value, fallback) => (typeof value === 'string' ? value.trim() : fallback);
const bool = (value, fallback) => (typeof value === 'boolean' ? value : fallback);
const int = (value, fallback, min, max) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
};

/** Merge a raw plugin row config over the defaults and coerce every field to a safe value. */
export function normalizeConfig(raw = {}) {
  const c = { ...DEFAULTS, ...raw };
  const out = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS)) {
    if (typeof DEFAULTS[key] === 'string') out[key] = text(c[key], DEFAULTS[key]);
  }
  out.autoStart = bool(c.autoStart, DEFAULTS.autoStart);
  out.allowedCallers = (Array.isArray(c.allowedCallers) ? c.allowedCallers : [])
    .map((id) => String(id).trim()).filter((id) => /^\d{3,20}$/.test(id));
  out.language = c.language === 'en' ? 'en' : 'zh';
  out.callOn = (Array.isArray(c.callOn) ? c.callOn : DEFAULTS.callOn).filter((e) => CALL_EVENTS.includes(e));
  out.quietHours = parseQuietHours(c.quietHours) || c.quietHours === '' ? text(c.quietHours, '') : DEFAULTS.quietHours;
  out.minCallIntervalMinutes = int(c.minCallIntervalMinutes, DEFAULTS.minCallIntervalMinutes, 0, 1440);
  out.maxCallsPerDay = int(c.maxCallsPerDay, DEFAULTS.maxCallsPerDay, 0, 100);
  out.ringTimeoutSeconds = int(c.ringTimeoutSeconds, DEFAULTS.ringTimeoutSeconds, 15, 120);
  out.retries = int(c.retries, DEFAULTS.retries, 0, 3);
  return out;
}

/** "23:00-08:00" -> minutes since midnight; null when empty or malformed. */
export function parseQuietHours(spec) {
  const match = /^\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*$/.exec(String(spec ?? ''));
  if (!match) return null;
  const [h1, m1, h2, m2] = match.slice(1).map(Number);
  if (h1 > 23 || h2 > 23 || m1 > 59 || m2 > 59) return null;
  const start = h1 * 60 + m1;
  const end = h2 * 60 + m2;
  return start === end ? null : { start, end };
}

export function inQuietHours(date, spec) {
  const range = parseQuietHours(spec);
  if (!range) return false;
  const minutes = date.getHours() * 60 + date.getMinutes();
  return range.start < range.end
    ? minutes >= range.start && minutes < range.end
    : minutes >= range.start || minutes < range.end;
}

/** The person called back: the explicit callbackUser, else the first allowed caller. */
export function callbackTarget(config) {
  const wanted = config.callbackUser;
  if (wanted && config.allowedCallers.includes(wanted)) return wanted;
  return config.allowedCallers[0];
}

/** Settings schema for the Settings UI. Optional: the plugin works without it. */
export async function buildSchema() {
  let Schema;
  try {
    Schema = (await import('@deepseek-ai/schemastery')).default;
  } catch {
    return undefined;
  }
  const str = (key, text) => Schema.string().default(DEFAULTS[key]).description(text);
  const num = (key, text, min, max) => Schema.number().min(min).max(max).default(DEFAULTS[key]).description(text);
  return Schema.object({
    allowedCallers: Schema.array(Schema.string()).default([]).description('Telegram numeric user ids allowed to call, and to be called. Empty rejects every call.'),
    callbackUser: str('callbackUser', 'User id the assistant phones. Empty uses the first allowed caller.'),
    assistantName: str('assistantName', 'Name the assistant uses for herself.'),
    language: Schema.union(['zh', 'en']).default('zh').description('Language of the conversation (zh or en).'),
    extraInstructions: str('extraInstructions', 'Extra persona or rules appended to the assistant prompt.'),
    autoStart: Schema.boolean().default(true).description('Start the voice agent and Telegram gateway with the plugin.'),
    callOn: Schema.array(Schema.union(['waiting', 'done', 'failed'])).default(DEFAULTS.callOn).description('Task events that make the assistant phone you.'),
    quietHours: str('quietHours', 'Local HH:MM-HH:MM window with no automatic calls; they wait until it ends. Empty disables. The Call me button ignores it.'),
    minCallIntervalMinutes: num('minCallIntervalMinutes', 'Minimum minutes between automatic calls.', 0, 1440),
    maxCallsPerDay: num('maxCallsPerDay', 'Automatic calls allowed in 24 hours. 0 turns automatic calls off.', 0, 100),
    ringTimeoutSeconds: num('ringTimeoutSeconds', 'Seconds to let the phone ring.', 15, 120),
    retries: num('retries', 'Extra attempts after a missed or busy call.', 0, 3),
    sttModel: str('sttModel', 'LiveKit Inference speech-to-text model.'),
    llmModel: str('llmModel', 'LiveKit Inference language model.'),
    ttsModel: str('ttsModel', 'LiveKit Inference text-to-speech model.'),
    ttsVoice: str('ttsVoice', 'Voice id for the text-to-speech model.'),
    agentName: str('agentName', 'LiveKit agent name the rooms dispatch to.'),
    workspacePath: str('workspacePath', 'Working directory for the DSH task sessions. Empty uses the default.'),
    agentPreset: str('agentPreset', 'Agent preset for the DSH task sessions. Empty uses the default.'),
    telegramSession: str('telegramSession', 'Name of the Telegram login session file.'),
    nodePath: str('nodePath', 'Path to node when it is not on PATH.'),
    npmPath: str('npmPath', 'Path to npm when it is not on PATH.'),
    pythonPath: str('pythonPath', 'Path to Python 3.10 or newer when it is not on PATH.'),
    livekitUrlEnv: str('livekitUrlEnv', 'Credential ref holding the LiveKit URL.'),
    livekitApiKeyEnv: str('livekitApiKeyEnv', 'Credential ref holding the LiveKit API key.'),
    livekitApiSecretEnv: str('livekitApiSecretEnv', 'Credential ref holding the LiveKit API secret.'),
    bridgeTokenEnv: str('bridgeTokenEnv', 'Credential ref holding the shared bridge token.'),
    telegramApiIdEnv: str('telegramApiIdEnv', 'Credential ref holding the Telegram api_id.'),
    telegramApiHashEnv: str('telegramApiHashEnv', 'Credential ref holding the Telegram api_hash.'),
  });
}
