# One In Twenty — Pass 2D

One In Twenty will become a flaky-browser-bug forensics tool that uses disposable Solari browser sessions to detect intermittent failures, amplify the trigger, minimize it, verify it, and generate a Playwright regression test.

**This directory currently implements Pass 1 plus the Pass 2 hunter with a real `/api/shipping` request.** It does not amplify, fingerprint, minimize, or generate tests.

## What is here

Pass 1 (`npm start`) proves the real Solari path: Sandbox, preview URL, one recorded browser, wait for shipping, successful Pay.

Pass 2 (`npm run hunt`) keeps **one Sandbox** and launches **20 fresh recorded Solari Browser sessions**.

Shipping is a real:

```
GET /api/shipping?method=express
```

A tiny Python server in the same Sandbox sleeps **250–899ms** then returns JSON `{ method, cost, delayMs }`. Pay still checks pending shipping ~80ms later. Wall-clock request time is longer than `delayMs` because of preview/path overhead.

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
npm run hunt -- --think-ms 820
npm run hunt -- --think-ms 860
```

Default `--think-ms` remains **720** (not calibrated). Runtime files land in `artifacts/` (gitignored).

## Verified results (real Solari runs)

### Timer-backed (old, in-page `setTimeout`)

| Think-time | Runs | PASS | APP_FAIL | INFRA_FAIL | Result |
|---|---|---|---|---|---|
| 780ms | 40 | 40 | 0 | 0 | NOT CALIBRATED |
| 750ms | 20 | 20 | 0 | 0 | too cold |
| 720ms | 20 | 16 | 4 | 0 | CALIBRATED (timer only) |

Those numbers are **not** network-backed.

### Network-backed (real `/api/shipping`)

| Think-time | Runs | PASS | APP_FAIL | INFRA_FAIL | Rate | Result |
|---|---|---|---|---|---|---|
| 720ms | 20 | 12 | 8 | 0 | 40% | too hot |
| 740ms | 20 | 12 | 8 | 0 | 40% | too hot |
| 820ms | 20 | 14 | 6 | 0 | 30% | too hot |
| 860ms | 20 | 11 | 9 | 0 | 45% | too hot |

**NETWORK BASELINE NOT CALIBRATED.** Two timings this pass (820 then 860). No more walks. Server delay stayed 250–899ms. No Pass 3.

820ms APP_FAIL: **#3 #5 #11 #13 #16 #20**. All `paying`. `delayMs`: 652, 857, 763, 870, 746, 782. (`shippingRequestMs` on this batch was inflated by the observe wait.)

860ms APP_FAIL: **#2 #4 #6 #10 #11 #12 #14 #16 #19**. All `paying`. `delayMs`: 788, 588, 856, 670, 859, 750, 742, 684, 612. `shippingRequestMs` ~1010–1093ms (server sleep plus real path). HTTP 200 on all fails.

20 unique Solari Browser IDs each batch. Fail screenshots captured. Some fail replays available; others stayed 404.
