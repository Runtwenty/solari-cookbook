# One In Twenty — Pass 4

One In Twenty will become a flaky-browser-bug forensics tool that uses disposable Solari browser sessions to detect intermittent failures, amplify the trigger, minimize it, verify it, and generate a Playwright regression test.

**Pass 4 fixed the shipping/pay race.** Pay no longer freezes in `paying` when `/api/shipping` is still in flight.

## What is here

Pass 1 (`npm start`) proves Sandbox → preview URL → recorded browser → wait for shipping → Pay.

Pass 2 (`npm run hunt`) keeps **one Sandbox** and launches **20 fresh recorded Solari Browser sessions**.

Shipping is a real:

```
GET /api/shipping?method=express
```

The Sandbox Python server sleeps **250–899ms** then returns JSON `{ method, cost, delayMs }`.

Payment used to do one 80ms `pending > 0` check and stay stuck. It now **completes when the current shipping request finishes**.

## Setup

```
cd examples/one-in-twenty-ts
npm install
export SOLARI_API_KEY=slr_live_your_key_here
```

## Commands

```
npm start
npm test
npm run hunt -- --think-ms 820
```

Runtime files land in `artifacts/` (gitignored).

## Pass 4 live proof (real Solari)

| Think-time | Runs | PASS | APP_FAIL | INFRA_FAIL |
|---|---|---|---|---|
| 820ms | 20 | 20 | 0 | 0 |
| 860ms | 20 | 20 | 0 | 0 |
| 720ms (random 250–899ms server delay) | 20 | 20 | 0 | 0 |

Several PASS runs had `shippingRequestMs` **after** the old 80ms race boundary (e.g. 1154ms at think 820) and still reached `paid`.

## Earlier measurement history (pre-fix)

Timer-backed: 780ms 40/0, 750ms 20/0, 720ms 16/4.

Network-backed pre-fix: 720ms 12/8, 740ms 12/8, 820ms 14/6, 860ms 11/9. All APP_FAIL were `paying` after HTTP 200.
