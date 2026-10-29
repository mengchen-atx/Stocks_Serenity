# scripts

Run any script with `npx tsx --env-file=.env.local scripts/<name>.ts`.

| Group | Files | Purpose |
|---|---|---|
| **Long-running services** | `stream-daemon.ts`, `xhs-daemon.ts` | Real-time X ingestion (deployed on Railway via `Dockerfile`), Xiaohongshu publisher |
| **Scheduled jobs** | `run-cron.ts`, `push-pending.ts` | Run the polling/push pipeline once locally; flush unsent pushes |
| **Channel setup** | `seed-channels.ts`, `setup-*.ts` | Create a channel and its watched X account |
| **Access management** | `grant-access.ts`, `check-user-access.ts`, `create-password-user.ts` | Grant or inspect per-channel subscriber access |
| **Backfill & repair** | `backfill-*.ts`, `reanalyze-tweet.ts`, `debug-failures.ts` | Re-ingest missed posts, re-run analysis, inspect failures |
| **LLM robustness tests** | `stress-test-*.ts` | Run edge-case posts through both models; reports go to `docs/benchmarks/` |
| **Integration checks** | `test-*.ts`, `check-db.ts` | Manual checks against live APIs (WxPusher, Notion, X, Xiaomi). They are not part of the unit test suite. |
| **Announcements** | `send-announcement.ts`, `send-apology-announcement.ts` | One-off subscriber broadcasts |

Unit tests live in [`/tests`](../tests) and run with `npm test`.
