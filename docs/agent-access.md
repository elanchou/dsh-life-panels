# Letting other agents use the data

Two ways in, for two kinds of agent. Both run the same operations as the panels, so validation, `#tag`
parsing, file locking and merging are identical whether a change comes from the UI, DSH chat, or Muse.

| | Agent API (MCP) | GitHub inbox |
|---|---|---|
| Plugin | `agent-api` | `cloud-sync` |
| Agent needs | An MCP or HTTP client and a token | Write access to the private sync repository |
| Latency | Immediate | Next sync (about 3 minutes after the last change, or every `intervalMin`) |
| Works while the Mac sleeps | No | Requests wait in the repo and run when it wakes |
| Commits | None | At most one per sync, shared with the data changes |
| Reads | Tools, including `dashboard_today` | The JSON files in the sync folder |

Use the Agent API when the agent can reach a URL (Muse, Claude, ChatGPT connectors, scripts). Use the inbox
when the agent can only touch GitHub, or as a fallback for writes while the computer is off.

## Agent API

Turn it on in ElansStack → Settings → Agent API, or in chat (`agent_api enable`). It listens on
`127.0.0.1:8780`. The public URL switch starts a Cloudflare quick tunnel (`cloudflared`, no account) and
shows an `https://….trycloudflare.com` address; that address changes every time the tunnel restarts. For a
fixed address, run a named Cloudflare tunnel or Tailscale Funnel to `127.0.0.1:8780` instead; nothing in the
plugin depends on the hostname.

Create one token per agent. A token is shown once and stored only as a SHA-256 hash. A read-only token
lists and runs only reading actions (for example `notes.list`, `market.quotes`). Every call is logged with
the token name, tool, action, result and duration.

```jsonc
// MCP client config (Streamable HTTP; responses are plain JSON)
{ "mcpServers": { "elans-stack": { "type": "http", "url": "https://<host>/mcp",
  "headers": { "Authorization": "Bearer dsh_…" } } } }
```

Clients that take only a URL can use `https://<host>/mcp/<token>`. Plain HTTP works too:

```sh
curl -s https://<host>/v1/tools -H "Authorization: Bearer dsh_…"
curl -s https://<host>/v1/tools/notes -H "Authorization: Bearer dsh_…" \
  -H 'content-type: application/json' -d '{"action":"add","body":"Buy milk #home"}'
```

`quick_capture` files one line the way the overview's capture box does (link → reading list, date or time →
reminder, otherwise a note), which is the easiest write for a voice or chat agent. `dashboard_today` returns overdue and today's reminders, focus and vocabulary progress, the current or next
trip, market indices and watchlist, headlines, new videos, unread articles, recent notes and weather in one
call; it is the intended first call for a daily briefing.

Never offered: `cloud_sync`, `lan_host`, `agent_api`, `icafe_workflow`, the TV proxy and phone-remote actions,
and the macOS Podcasts import. The rules live in `shared/host/policy.js` and apply to both ways in.

## GitHub inbox

cloud-sync writes a `README.md` into the sync folder that describes this for the agent. In short: append
JSON lines to any `dsh-sync/inbox/*.jsonl` file and commit once per batch.

```
{"id":"muse-2026-11-16-1","tool":"calendar_reminders","args":{"action":"add","title":"Dentist","date":"2026-11-20","time":"15:00"}}
{"id":"muse-2026-11-16-2","tool":"notes","args":{"action":"check","id":"<note id>","index":0}}
```

On the next sync DSH runs each request, appends `{"id","at","ok","result"|"error"}` to
`dsh-sync/outbox/results.jsonl`, deletes the processed inbox files, and pushes all of that together with the
data files the requests changed. Ids that already ran are skipped, and a line without an id gets a stable
one from its text, so a request never runs twice.

## Why not have agents edit the JSON files

It works with the three-way merge, but each agent would have to know every file's shape, keep ids and
`updatedAt` right, and would create a commit per edit. Requests are smaller, validated, and fold into the one
sync commit.

## Commit volume

A sync now writes every changed file in one commit through the Git Data API (tree, commit, fast-forward ref),
and redoes the run if the branch moved meanwhile. Syncs start 3 minutes after the last local edit, and at most
every `intervalMin` (default 10) otherwise. Podcast progress saves often, so a day of listening still produces
at most one commit per interval. A sync with no change makes no commit.
