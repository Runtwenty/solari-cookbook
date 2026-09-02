# One In Twenty — Pass 1

One In Twenty will become a flaky-browser-bug forensics tool that uses disposable Solari browser sessions to detect intermittent failures, amplify the trigger, minimize it, verify it, and generate a Playwright regression test.

**This directory currently implements Pass 1 only.** It does not hunt, amplify, fingerprint, or generate tests.

Pass 1 proves the real Solari path:

1. A tiny checkout fixture runs inside a Solari Sandbox.
2. The sandbox exposes a public preview URL.
3. One recorded Solari Browser session opens that URL.
4. It completes one ordinary successful checkout.
5. Browser and sandbox resources are released.

The fixture has a shipping/pay race, but Pass 1 waits for shipping to settle. It does not try to force the failure.

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

Expect log lines for `sandbox:`, `preview:`, `browser_session:`, `checkout_state: paid`, then `browser_released` and `sandbox_killed`. Replay may appear a few seconds after the session is released.
