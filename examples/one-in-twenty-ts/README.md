# One In Twenty — Pass 2

One In Twenty will become a flaky-browser-bug forensics tool that uses disposable Solari browser sessions to detect intermittent failures, amplify the trigger, minimize it, verify it, and generate a Playwright regression test.

**This directory currently implements Pass 1 plus the Pass 2 baseline hunter.** It does not amplify, fingerprint, minimize, or generate tests.

## What is here

Pass 1 (`npm start`) proves the real Solari path with one recorded browser session and a successful checkout that waits for shipping to settle.

Pass 2 (`npm run hunt`) keeps **one Sandbox** and launches **20 fresh recorded Solari Browser sessions** against the same preview URL.

Each hunt run:

1. Opens the checkout fixture.
2. Changes shipping to Express.
3. Waits **780ms** of user think-time. It does **not** click Pay immediately.
4. Clicks Pay.
5. Classifies the final `data-state`.

The fixture's random shipping delay (250–899ms) is unchanged.

## Classification

| Result | Meaning |
|---|---|
| `PASS` | Reached `data-state="paid"` |
| `APP_FAIL` | Checkout ended in `paying`, `error`, or otherwise failed to reach paid |
| `INFRA_FAIL` | Solari/browser/preview broke. Not counted as the race. |

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

## Run Pass 2 baseline

```
npm run hunt
```

Runtime files land in `artifacts/` (gitignored): `baseline.json` plus screenshots.

## Verified baseline (real Solari run)

Think-time after shipping change: **780ms**.

| Batch | Runs | PASS | APP_FAIL | INFRA_FAIL |
|---|---|---|---|---|
| Baseline | 20 | 20 | 0 | 0 |
| Diagnostic (same timing) | 20 | 20 | 0 | 0 |
| Combined | 40 | 40 | 0 | 0 |

**BASELINE NOT CALIBRATED.** 40 recorded sessions, 40 unique Solari Browser IDs, one Sandbox, zero application failures.

Replay for the representative PASS session became available after the batch. One PASS screenshot was captured. No APP_FAIL screenshots exist because no APP_FAIL occurred.

Next timing to try in a later calibration pass, not this one: about **500–600ms** think-time. Do not click Pay immediately (that makes the race almost certain). Do not change the fixture delay range just to pretty up the score.
