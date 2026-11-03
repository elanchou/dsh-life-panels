# DSH Life Panels

A set of sidebar plugins for DeepSeek Harness. Each plugin adds a panel to the Web UI and a tool the agent can call.

| Plugin | Panel | Agent tool | What it does |
| --- | --- | --- | --- |
| [calendar-reminders](plugins/calendar-reminders) | 日历 | `calendar_reminders` | Month calendar and reminder list. A reminder can post a chat message in its session when it is due. |
| [news-feeds](plugins/news-feeds) | 新闻 | `news_feeds` | RSS/Atom reader with tech, business and world categories, search, and "read later". |
| [reading-list](plugins/reading-list) | 稍后读 | `reading_list` | Save links or text; the article text is extracted in the background. Tracks progress, notes and tags. |
| [travel-planner](plugins/travel-planner) | 旅行 | `travel_planner` | Day-by-day itinerary, budget and expenses, packing list, 16-day Open-Meteo forecast. |
| [podcasts](plugins/podcasts) | 播客 | `podcasts` | Apple Podcasts directory search and chart, RSS subscriptions, queue, resume playback. |
| [cloud-sync](plugins/cloud-sync) | 云同步 | `cloud_sync` | Syncs the data of the five plugins above to a private GitHub repository with a per-record three-way merge. |

The UI is Chinese and English, follows the Harness theme tokens, and works in light and dark mode. Surfaces use frosted glass: translucent layers over a soft ambient backdrop, with backdrop blur reserved for the floating bars and toasts that content scrolls beneath (blurring every list card made scrolling stutter); they fall back to opaque layers when the browser lacks `backdrop-filter` or the system asks for reduced transparency.

## Install

Requires Node.js 20 or newer and a DeepSeek Harness profile.

```sh
git clone git@github.com:elanchou/dsh-life-panels.git
cd dsh-life-panels
npm run build        # generates client.js / common.js / merge.js in each plugin
```

Then install each plugin directory as a bundle. In a Harness chat, ask the agent to install them, or use the plugin manager with the absolute path, for example `…/dsh-life-panels/plugins/podcasts`. Install only the ones you want; cloud-sync works with any subset.

After pulling updates, run `npm run build` again and reinstall (or bump the version) so the Harness reloads the changed files.

## Data

Each plugin stores one JSON file in `$DSH_HOME/plugin-data/` (`calendar-reminders.json`, `news-feeds.json`, `reading-list.json`, `travel-planner.json`, `podcasts.json`). Writes are atomic. If another writer replaces a file (for example cloud-sync), the plugin re-reads it and merges its own unsaved changes instead of overwriting.

## Cloud sync

1. Create a [fine-grained token](https://github.com/settings/personal-access-tokens/new) with **Contents: Read and write** on the sync repository. To let the plugin create the repository, the token also needs account **Administration: write**; otherwise create an empty private repository first.
2. Open the 云同步 panel, enter the token and the repository name (default `dsh-life-data`), and connect.
3. Connect the same repository on every computer.

How it works:

- Each data file is stored as `dsh-sync/<plugin>.json`, and every sync is a commit, so GitHub keeps the history.
- The last synced version is kept locally as the merge base. Records (`id`, `key`, or `url` on first sync) are merged one by one: additions and deletions from both sides are kept, an edit wins over a concurrent delete, and when both sides changed the same field the one with the newer `updatedAt` wins.
- Uploads are conditional on the file's blob sha. If another machine pushed first, the plugin pulls, merges and retries.
- Sync runs at startup, every 10 minutes (5–1440, configurable), and about 90 seconds after a local edit.
- The token is kept in the Harness credential store. It is never written to data files or returned to the agent, and the plugin refuses public repositories. Data is not end-to-end encrypted.

## Development

```
shared/host/common.js     Store, authenticated routes, tool registration, fetch helpers
shared/host/merge.js      three-way merge and the cross-plugin file lock
shared/client/kit.js      React helpers, icons and lp-* styles used by every panel
shared/client/glass.js    frosted-glass tokens (translucent layers, backdrop blur, ambient backdrop)
plugins/<name>/index.js   Host half: data, route /plugin-api/<name>, agent tool
plugins/<name>/src/client.js   Web half; `/* @kit */` is replaced by shared/client/kit.js
scripts/build.mjs         copies shared code into each plugin and assembles client.js
test/                     node --test suites (merge, GitHub sync against a local fake, Store)
```

Generated files are git-ignored. `npm test` builds and runs the tests; `npm run check` fails if a generated file is out of date.

Client code runs inside the Harness module loader and only uses `react` plus the `slots` and `locale` services. It does not import Harness client packages, so it keeps working across Harness UI updates.

## License

[MIT](LICENSE)
