/**
 * Which agent tools and actions may be used from outside DSH (the agent-api MCP endpoint, and the GitHub inbox of
 * cloud-sync). Shared so both doors apply the same rules. A tool is { name, description, parameters, run }.
 */

/** Tools never offered outside DSH: they hold credentials or open network access. */
export const EXCLUDED_TOOLS = new Set(['cloud_sync', 'lan_host', 'agent_api', 'icafe_workflow']);
/** Actions never offered outside DSH, per tool. */
export const EXCLUDED_ACTIONS = {
  iptv: ['settings', 'test_proxy', 'remote', 'remote_command'],
  podcasts: ['import_apple'],
};
/** Actions that only read. A read-only token gets these and nothing else; an unknown action counts as a write. */
export const READ_ACTIONS = {
  calendar_reminders: ['list'],
  news_feeds: ['headlines', 'feeds'],
  reading_list: ['list', 'get'],
  travel_planner: ['list_trips', 'get_trip'],
  podcasts: ['search', 'top', 'shows', 'latest', 'episode', 'queue', 'picks', 'import_status'],
  vocabulary: ['status', 'session', 'list', 'lookup'],
  focus: ['status', 'history'],
  youtube: ['search', 'channels', 'latest'],
  iptv: ['channels', 'playlists'],
  market: ['quotes', 'search', 'history'],
  notes: ['list', 'get'],
  ecommerce: ['dashboard', 'todo', 'report', 'list', 'get', 'calc', 'price_for', 'rates', 'list_orders', 'export_orders', 'list_purchases', 'list_costs'],
  dashboard_today: ['*'],
};

function actionEnum(tool) {
  const a = tool.parameters && tool.parameters.properties && tool.parameters.properties.action;
  return a && Array.isArray(a.enum) ? a.enum : null;
}
export function allowedActions(tool, scope) {
  const all = actionEnum(tool);
  if (!all) return null; // a tool without actions
  const banned = new Set(EXCLUDED_ACTIONS[tool.name] || []);
  const reads = new Set(READ_ACTIONS[tool.name] || []);
  return all.filter((a) => !banned.has(a) && (scope === 'write' || reads.has(a) || reads.has('*')));
}
export function toolAllowed(tool, token) {
  if (EXCLUDED_TOOLS.has(tool.name)) return false;
  if (token.tools && token.tools.length && !token.tools.includes(tool.name)) return false;
  if (token.scope !== 'write') {
    const reads = READ_ACTIONS[tool.name];
    if (!reads) return false;
    const acts = allowedActions(tool, 'read');
    if (acts && !acts.length) return false;
  }
  return true;
}

/** The tool as an external client sees it: the action list narrowed to what this token may run. */
export function publicTool(tool, token) {
  const acts = allowedActions(tool, token.scope);
  const params = JSON.parse(JSON.stringify(tool.parameters || { type: 'object', properties: {} }));
  if (acts && params.properties && params.properties.action) params.properties.action.enum = acts;
  const note = token.scope === 'write' ? '' : ' (Read-only access: only reading actions are available.)';
  return { name: tool.name, description: tool.description + note, inputSchema: params };
}

export function checkCall(tool, token, args) {
  if (!tool || !toolAllowed(tool, token)) return 'Unknown tool';
  const acts = allowedActions(tool, token.scope);
  if (acts) {
    const action = args && args.action;
    if (typeof action !== 'string' || !acts.includes(action)) {
      return 'Action ' + JSON.stringify(action) + ' is not available' + (token.scope === 'write' ? '' : ' to a read-only token') + '. Allowed: ' + acts.join(', ');
    }
  }
  return null;
}
