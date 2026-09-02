/**
 * Pass 2 — 20 fresh recorded Solari Browser sessions against one Sandbox fixture.
 *
 * Does not wait for shipping to settle. After switching to Express it waits
 * ~780ms of user think-time, then clicks Pay. The fixture's random 250–899ms
 * shipping delay is left alone.
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { SolariClient } from "@solarisdk/sdk"
import { Solari } from "@solarisdk/browser"
import { FIXTURE_HTML } from "./fixture.ts"

const RUNS = 20
const PORT = 3000
const THINK_MS = 780
const PAY_OBSERVE_MS = 3000
const HERE = dirname(fileURLToPath(import.meta.url))
const ARTIFACTS = join(HERE, "..", "artifacts")

type Outcome = "PASS" | "APP_FAIL" | "INFRA_FAIL"

type RunResult = {
  run: number
  sessionId: string | null
  recording: boolean
  startedAt: string
  elapsedMs: number
  thinkMs: number
  state: string | null
  statusText: string | null
  outcome: Outcome
  replay: string | null
  screenshot: string | null
  error: string | null
}

function requireApiKey(): string {
  const apiKey = process.env.SOLARI_API_KEY
  if (!apiKey) {
    console.error("Missing SOLARI_API_KEY")
    process.exit(1)
  }
  if (!apiKey.startsWith("slr_live_")) {
    console.error("SOLARI_API_KEY does not look like a Solari key")
    process.exit(1)
  }
  return apiKey
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function redactUrl(url: string) {
  return url.split("?")[0]
}

function errText(err: unknown) {
  return err instanceof Error ? err.message : String(err)
}

async function waitForPreview(url: string) {
  for (let i = 0; i < 15; i++) {
    await sleep(1000)
    try {
      const res = await fetch(url)
      if (res.ok) {
        const text = await res.text()
        if (text.includes("Pay") && text.includes("One In Twenty")) {
          console.log("preview_fetch: ok")
          return
        }
      }
      console.log(`  waiting for preview (HTTP ${res.status})`)
    } catch (err) {
      console.log(`  waiting for preview (${errText(err)})`)
    }
  }
  throw new Error("preview URL did not become reachable")
}

async function pollReplay(
  solari: Solari,
  sessionId: string,
): Promise<string | null> {
  const sessions = solari.sessions as {
    getReplayUrl?: (id: string) => Promise<{ url?: string } | string>
  }
  if (typeof sessions.getReplayUrl !== "function") return null
  for (let attempt = 1; attempt <= 12; attempt++) {
    await sleep(3000)
    try {
      const result = await sessions.getReplayUrl(sessionId)
      const url = typeof result === "string" ? result : result?.url
      if (url) return redactUrl(url)
    } catch (err) {
      const anyErr = err as { status?: number; statusCode?: number }
      const status = anyErr.status ?? anyErr.statusCode
      console.log(`  replay ${sessionId}: attempt ${attempt} ${status ?? errText(err)}`)
    }
  }
  return null
}

async function observeCheckout(page: {
  locator: (selector: string) => {
    getAttribute: (name: string) => Promise<string | null>
    innerText: () => Promise<string>
  }
}) {
  const status = page.locator("#status")
  const deadline = Date.now() + PAY_OBSERVE_MS
  let state: string | null = null
  let statusText: string | null = null
  while (Date.now() < deadline) {
    state = await status.getAttribute("data-state")
    statusText = await status.innerText()
    if (state === "paid" || state === "error") break
    await sleep(50)
  }
  if (state === null) {
    state = await status.getAttribute("data-state")
    statusText = await status.innerText()
  }
  return { state, statusText }
}

async function huntBatch(opts: {
  previewUrl: string
  solari: Solari
  startRun: number
  count: number
  capturedPassShot: { value: boolean }
}): Promise<RunResult[]> {
  const results: RunResult[] = []
  mkdirSync(ARTIFACTS, { recursive: true })

  for (let i = 0; i < opts.count; i++) {
    const run = opts.startRun + i
    const started = Date.now()
    const row: RunResult = {
      run,
      sessionId: null,
      recording: true,
      startedAt: new Date(started).toISOString(),
      elapsedMs: 0,
      thinkMs: THINK_MS,
      state: null,
      statusText: null,
      outcome: "INFRA_FAIL",
      replay: null,
      screenshot: null,
      error: null,
    }

    let browser: Awaited<ReturnType<Solari["launch"]>> | undefined
    try {
      browser = await opts.solari.launch({ recording: true })
      row.sessionId = browser.id
      console.log(`run ${run}: session ${browser.id}`)

      const page = await browser.newPage()
      await page.goto(opts.previewUrl, { waitUntil: "domcontentloaded" })
      await page.locator("#pay").waitFor()
      await page.locator("#shipping").selectOption("express")
      await sleep(THINK_MS)
      await page.locator("#pay").click()

      const observed = await observeCheckout(page)
      row.state = observed.state
      row.statusText = observed.statusText
      row.outcome = observed.state === "paid" ? "PASS" : "APP_FAIL"

      const wantShot =
        row.outcome === "APP_FAIL" ||
        (row.outcome === "PASS" && !opts.capturedPassShot.value)
      if (wantShot) {
        const name =
          row.outcome === "APP_FAIL"
            ? `run-${String(run).padStart(2, "0")}-fail.png`
            : `run-${String(run).padStart(2, "0")}-pass.png`
        const path = join(ARTIFACTS, name)
        try {
          await page.screenshot({ path })
          row.screenshot = name
          if (row.outcome === "PASS") opts.capturedPassShot.value = true
        } catch (err) {
          console.log(`run ${run}: screenshot skipped (${errText(err)})`)
        }
      }
    } catch (err) {
      row.outcome = "INFRA_FAIL"
      row.error = errText(err)
      console.log(`run ${run}: INFRA_FAIL ${row.error}`)
    } finally {
      if (browser) {
        try {
          await browser.close()
        } catch (err) {
          console.log(`run ${run}: browser close ${errText(err)}`)
        }
      }
      row.elapsedMs = Date.now() - started
      results.push(row)
      console.log(
        `run ${run}: ${row.outcome} state=${row.state ?? "n/a"} ${row.elapsedMs}ms`,
      )
    }
  }
  return results
}

function summarize(results: RunResult[]) {
  const passes = results.filter((r) => r.outcome === "PASS").length
  const appFailures = results.filter((r) => r.outcome === "APP_FAIL").length
  const infraFailures = results.filter((r) => r.outcome === "INFRA_FAIL").length
  const appAttempts = passes + appFailures
  const failureRate = appAttempts === 0 ? 0 : appFailures / appAttempts
  return { passes, appFailures, infraFailures, appAttempts, failureRate }
}

function printSummary(label: string, results: RunResult[]) {
  const s = summarize(results)
  const pct = (s.failureRate * 100).toFixed(1)
  console.log("")
  console.log(`ONE IN TWENTY — ${label}`)
  console.log(`Runs:           ${results.length}`)
  console.log(`Passed:         ${s.passes}`)
  console.log(`App failures:   ${s.appFailures}`)
  console.log(`Infra failures: ${s.infraFailures}`)
  console.log(`Failure rate:   ${pct}%`)
  const fails = results.filter((r) => r.outcome === "APP_FAIL")
  if (fails.length) {
    for (const fail of fails) {
      console.log(`FAILURE FOUND`)
      console.log(`Run #${fail.run}`)
      console.log(`State: ${fail.state}`)
      console.log(`Status: ${fail.statusText}`)
    }
  }
}

const apiKey = requireApiKey()
const pt = new SolariClient({ apiKey })
const solari = new Solari({ apiKey })

const sandbox = await pt.sandboxes.create({
  template: "base",
  timeoutMs: 20 * 60_000,
})
console.log("sandbox:", sandbox.sandboxId)

const allResults: RunResult[] = []
try {
  await sandbox.connect()
  await sandbox.files.write("/tmp/site/index.html", FIXTURE_HTML)
  await sandbox.commands.run("sh", {
    args: ["-c", `cd /tmp/site && nohup python3 -m http.server ${PORT} >/dev/null 2>&1 &`],
  })
  const { url } = await sandbox.previewUrl(PORT)
  console.log("preview:", redactUrl(url))
  if (!/getsolari\.com/i.test(url)) {
    throw new Error("preview URL is not a Solari host")
  }
  await waitForPreview(url)

  const capturedPassShot = { value: false }
  const first = await huntBatch({
    previewUrl: url,
    solari,
    startRun: 1,
    count: RUNS,
    capturedPassShot,
  })
  allResults.push(...first)
  printSummary("BASELINE", first)

  const firstSummary = summarize(first)
  if (firstSummary.appFailures === 0 && firstSummary.infraFailures < RUNS) {
    console.log("zero APP_FAIL in first 20 — diagnostic batch of 20, same timing")
    const second = await huntBatch({
      previewUrl: url,
      solari,
      startRun: 21,
      count: RUNS,
      capturedPassShot,
    })
    allResults.push(...second)
    printSummary("DIAGNOSTIC", second)
    printSummary("COMBINED", allResults)
  }

  const replayIds: string[] = []
  for (const row of allResults) {
    if (row.outcome === "APP_FAIL" && row.sessionId) replayIds.push(row.sessionId)
  }
  const passId = allResults.find((r) => r.outcome === "PASS" && r.sessionId)?.sessionId
  if (passId && !replayIds.includes(passId)) replayIds.push(passId)

  console.log(`replay poll: ${replayIds.length} session(s)`)
  for (const id of replayIds) {
    const replay = await pollReplay(solari, id)
    const row = allResults.find((r) => r.sessionId === id)
    if (row) row.replay = replay
    console.log(`replay ${id}: ${replay ?? "unavailable"}`)
  }
} finally {
  try {
    await sandbox.kill()
    console.log("sandbox_killed: true")
  } catch (err) {
    console.log("sandbox_kill_error:", errText(err))
  }
  try {
    await solari.close()
    console.log("solari_closed: true")
  } catch (err) {
    console.log("solari_close_error:", errText(err))
  }
}

const summary = summarize(allResults)
const ids = allResults.map((r) => r.sessionId).filter((id): id is string => Boolean(id))
const uniqueSessions = new Set(ids)
console.log(`fresh_sessions: ${uniqueSessions.size}/${ids.length}`)

mkdirSync(ARTIFACTS, { recursive: true })
writeFileSync(
  join(ARTIFACTS, "baseline.json"),
  JSON.stringify(
    {
      thinkMs: THINK_MS,
      runs: allResults.length,
      passes: summary.passes,
      appFailures: summary.appFailures,
      infraFailures: summary.infraFailures,
      failureRate: Number(summary.failureRate.toFixed(4)),
      uniqueSessions: uniqueSessions.size,
      sandboxId: sandbox.sandboxId,
      results: allResults,
    },
    null,
    2,
  ),
)
console.log("wrote artifacts/baseline.json")

if (summary.appAttempts > 0 && summary.failureRate > 0.25) {
  console.log("BASELINE TOO HOT")
} else if (summary.appFailures === 0) {
  console.log("BASELINE NOT CALIBRATED")
}
