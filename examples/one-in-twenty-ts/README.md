# One In Twenty — Pass 2C

One In Twenty will become a flaky-browser-bug forensics tool that uses disposable Solari browser sessions to detect intermittent failures, amplify the trigger, minimize it, verify it, and generate a Playwright regression test.

**This directory currently implements Pass 1 plus the Pass 2 hunter with a real `/api/shipping` request.** It does not amplify, fingerprint, minimize, or generate tests.

## What is here

Pass 1 (`npm start`) proves the real Solari path: Sandbox, preview URL, one recorded browser, wait for shipping, successful Pay.

Pass 2 (`npm run hunt`) keeps **one Sandbox** and launches **20 fresh recorded Solari Browser sessions**.

Shipping is no longer a client `setTimeout`. Changing shipping fires:

```
GET /api/shipping?method=express
```

A tiny Python server in the same Sandbox sleeps **250–899ms** then returns JSON `{ method, cost, delayMs }`. Pay still checks pending shipping ~80ms later. That is the race.

## Classification

| Result | Meaning |
|---|---|
| `PASS` | Reached `data-state="paid"` after a normal delayed `/api/shipping` 200 |
| `APP_FAIL` | `/api/shipping` returned 200 and checkout stuck in `paying`/`error` |
| `INFRA_FAIL` | Solari/preview/browser broke, or `/api/shipping` never returned / 5xx |

Only `APP_FAIL` counts toward the application failure rate.

## Setup

```
cd examples/one-in-twenty-ts
npm install
export SOLARI_API_KEY=slr_live_your_key_here
```

Get a key at [console.getsolari.com](https://console.getsolari.com). Do not put the real key in this repo.

## Run Pass 1

```
npm start
```

## Run Pass 2 hunt

```
npm run hunt -- --think-ms 720
npm run hunt -- --think-ms 740
```

Default `--think-ms` is 720. Runtime files land in `artifacts/` (gitignored).

## Verified results (real Solari runs)

### Timer-backed calibration (old, in-page `setTimeout`)

| Think-time | Runs | PASS | APP_FAIL | INFRA_FAIL | Result |
|---|---|---|---|---|---|
| 780ms | 40 | 40 | 0 | 0 | NOT CALIBRATED |
| 750ms | 20 | 20 | 0 | 0 | too cold |
| 720ms | 20 | 16 | 4 | 0 | CALIBRATED |

Those numbers are **not** network-backed.

### Network-backed calibration (current, real `/api/shipping`)

Pass 1 after the refactor: **paid**, `Paid express $35`.

| Think-time | Runs | PASS | APP_FAIL | INFRA_FAIL | Result |
|---|---|---|---|---|---|
| 720ms | 20 | 12 | 8 | 0 | too hot |
| 740ms | 20 | 12 | 8 | 0 | too hot |

**NETWORK BASELINE NOT CALIBRATED.** Real HTTP adds path latency on top of the 250–899ms server sleep, so the same think-times fail more often than the old timer. Server `delayMs` was recorded on every fail (HTTP 200). Delay range was not changed. No extra batches. No Pass 3.

720ms APP_FAIL runs: **#1, #2, #4, #5, #6, #13, #14, #20**. All `paying` / `Processing payment…`. Example `shippingDelayMs`: 678, 729, 700, 743, 817, 795, 708, 792.

740ms APP_FAIL runs: **#4, #7, #9, #10, #13, #16, #18, #19**. All `paying`. Example `shippingDelayMs`: 622, 731, 828, 542, 726, 607, 813, 845.

20 unique Solari Browser IDs each batch. Fail screenshots captured. Some fail replays became available after poll; others stayed 404.
