import { createHash } from 'node:crypto';
import { lanRegistry } from './common.js';
import { checkCall } from './policy.js';

/**
 * GitHub inbox: lets an agent that can only reach the sync repository (no access to this computer) change data
 * without editing the JSON files, and without adding many commits.
 *
 *   The agent appends one line per request to  <dir>/inbox/<anything>.jsonl  (one commit for a whole batch):
 *     {"id":"<unique>","tool":"notes","args":{"action":"add","body":"…"}}
 *   On the next sync DSH runs each request through the same tool operations the panels use, writes one line per
 *   request to  <dir>/outbox/results.jsonl  ({"id","at","ok","result"|"error"}), and removes the processed inbox
 *   files — all inside the sync's single commit. The data files it changed go up in that same commit.
 *
 * Requests follow the agent-api write policy (credential tools and network settings are refused). Reading needs
 * no inbox: the agent reads the JSON data files in the same folder directly.
 */

export const INBOX = 'inbox';
export const OUTBOX = 'outbox/results.jsonl';
const MAX_REQUESTS = 200;
const MAX_RESULTS = 500;
const MAX_RESULT_CHARS = 4000;
const POLICY_TOKEN = { scope: 'write' };

export function parseInbox(text) {
  const out = [];
  for (const raw of String(text).split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('//')) continue;
    // A request without an id gets one from its text, so a line that stays in the inbox never runs twice.
    const auto = 'auto-' + createHash('sha1').update(line).digest('hex').slice(0, 16);
    try {
      const r = JSON.parse(line);
      out.push(r && typeof r === 'object' && !Array.isArray(r) ? (r.id === undefined ? { ...r, id: auto } : r) : { _bad: line.slice(0, 200), id: auto });
    } catch { out.push({ _bad: line.slice(0, 200), id: auto }); }
  }
  return out;
}

function trimResult(result) {
  const text = JSON.stringify(result);
  if (text.length <= MAX_RESULT_CHARS) return result;
  return { truncated: true, ok: result && result.ok, preview: text.slice(0, MAX_RESULT_CHARS) };
}

/** Run inbox requests through the registered tools. Returns result lines (oldest first). */
export async function runRequests(requests, { tools = () => lanRegistry().tools, now = () => new Date().toISOString(), seen = new Set() } = {}) {
  const results = [];
  for (const r of requests.slice(0, MAX_REQUESTS)) {
    const id = String(r.id).slice(0, 80);
    if (seen.has(id)) continue; // a request repeated across files runs once
    seen.add(id);
    if (r._bad) { results.push({ id, at: now(), ok: false, error: 'Not a JSON line: ' + r._bad }); continue; }
    const tool = tools().get(String(r.tool || ''));
    const args = r.args && typeof r.args === 'object' ? r.args : {};
    const denied = checkCall(tool, POLICY_TOKEN, args);
    if (denied) { results.push({ id, at: now(), tool: r.tool, ok: false, error: denied }); continue; }
    try {
      const out = await tool.run(args, undefined, { external: true, client: 'github-inbox' });
      if (out && out.ok === false) results.push({ id, at: now(), tool: r.tool, action: args.action, ok: false, error: String(out.error || 'failed') });
      else results.push({ id, at: now(), tool: r.tool, action: args.action, ok: true, result: trimResult(out) });
    } catch (e) {
      results.push({ id, at: now(), tool: r.tool, action: args.action, ok: false, error: e && e.message ? e.message : String(e) });
    }
  }
  if (requests.length > MAX_REQUESTS) results.push({ id: 'inbox-limit', at: now(), ok: false, error: 'Only ' + MAX_REQUESTS + ' requests run per sync; the rest were dropped' });
  return results;
}

/** Append results to the outbox text, keeping the newest MAX_RESULTS lines. */
export function appendOutbox(previous, results) {
  const lines = String(previous || '').split('\n').filter(Boolean).concat(results.map((r) => JSON.stringify(r)));
  return lines.slice(-MAX_RESULTS).join('\n') + '\n';
}

/** Instructions kept next to the data in the sync repository, for any agent that reads it. */
export function agentReadme(dir, files, tools) {
  const lines = [
    '# DSH life-panels data',
    '',
    'This folder is synced by the DSH cloud-sync plugin. One JSON file per panel: ' + files.map((f) => '`' + f + '.json`').join(', ') + '.',
    '',
    '## Reading',
    '',
    'Read the JSON files directly. They are rewritten by DSH; treat them as read-only.',
    '',
    '## Changing data',
    '',
    'Do not edit the JSON files. Append requests to a file in `' + dir + '/inbox/` (any name ending in `.jsonl`), one JSON object per line,',
    'and commit them together (one commit for a whole batch keeps the history short):',
    '',
    '```',
    '{"id":"2026-11-16-1","tool":"notes","args":{"action":"add","body":"Buy milk #home"}}',
    '{"id":"2026-11-16-2","tool":"calendar_reminders","args":{"action":"add","title":"Dentist","date":"2026-11-20","time":"15:00"}}',
    '```',
    '',
    'On its next sync (within minutes while the computer is on) DSH runs each request with the same operations the panels use,',
    'appends one line per request to `' + dir + '/outbox/results.jsonl` (`{"id","at","ok","result"|"error"}`) and deletes the',
    'processed inbox files, all in one commit. Give each request a unique `id` to match its result; an id that already ran is skipped.',
    '',
    '## Tools',
    '',
    ...tools.map((t) => '- `' + t.name + '`: ' + t.description.replace(/\s+/g, ' ').slice(0, 600)),
    '',
    'For live access instead of waiting for a sync, use the MCP endpoint of the DSH agent-api plugin.',
    '',
  ];
  return lines.join('\n');
}
