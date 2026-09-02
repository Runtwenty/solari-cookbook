# One In Twenty — Pass 2

One In Twenty will become a flaky-browser-bug forensics tool that uses disposable Solari browser sessions to detect intermittent failures, amplify the trigger, minimize it, verify it, and generate a Playwright regression test.

**This directory currently implements Pass 1 plus the Pass 2 baseline hunter.** It does not amplify, fingerprint, minimize, or generate tests.

## What is here

Pass 1 (`npm start`) proves the real Solari path with one recorded browser session and a successful checkout that waits for shipping to settle.

Pass 2 (`npm run hunt`) keeps **one Sandbox** and launches **20 fresh recorded Solari Browser sessions** against the same preview URL.

Each hunt run:

1. Opens the checkout fixture.
2. Changes shipping to Express.
3. Waits configurable user think-time. It does **not** click Pay immediately.
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

Recommended calibrated think-time is **720ms**:

```
npm run hunt
npm run hunt -- --think-ms 720
```

Override if needed:

```
npm run hunt -- --think-ms 750
```

Default think-time is 720ms. Runtime files land in `artifacts/` (gitignored): `baseline.json` plus screenshots.

## Verified results (real Solari runs)

The fixture waits ~80ms after Pay before checking pending shipping. Failure is expected when shipping delay stays above think-time + 80ms. The planted delay range was not changed.

| Think-time | Runs | PASS | APP_FAIL | INFRA_FAIL | Result |
|---|---|---|---|---|---|
| 780ms | 40 | 40 | 0 | 0 | BASELINE NOT CALIBRATED |
| 750ms | 20 | 20 | 0 | 0 | still too cold |
| **720ms** | **20** | **16** | **4** | **0** | **BASELINE CALIBRATED** |

720ms APP_FAIL runs: **#8, #15, #17, #19**. All ended `data-state="paying"` / `Processing payment…`.

20 unique Solari Browser session IDs at 720ms. Fail screenshots: `run-08-fail.png`, `run-15-fail.png`, `run-17-fail.png`, `run-19-fail.png`. One PASS screenshot. Replay for run #19 became available after the batch; earlier fail replays were still 404 after polling.

Do not click Pay immediately. That makes the race almost certain. Do not drop below 720ms in this pass.
