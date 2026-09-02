/**
 * Browser quickstart — launch a cloud browser, open a page, read it, close.
 *
 * `launch()` creates a session and connects a Playwright-compatible browser to
 * it in one call. Everything after that is ordinary Playwright: the browser
 * just happens to be running on Solari's infrastructure rather than your laptop.
 */
import "dotenv/config"
import { Solari } from "@solarisdk/browser"

const apiKey = process.env.SOLARI_API_KEY
if (!apiKey) {
  console.error("SOLARI_API_KEY is not set — copy .env.example to .env and paste your key (https://console.getsolari.com)")
  process.exit(1)
}
const solari = new Solari({ apiKey })

// `browser.close()` also RELEASES the session. Closing the browser alone would
// leave the slot held until the plan deadline, so prefer try/finally (or
// `await using browser = ...` on Node 22+, which disposes it for you).
const browser = await solari.launch()
try {
  const page = await browser.newPage()
  await page.goto("https://example.com")

  console.log("title :", await page.title())
  console.log("h1    :", await page.locator("h1").innerText())
  console.log("session:", browser.id)
} finally {
  await browser.close()
  // REQUIRED in Node, and easy to miss: the client keeps a loopback proxy
  // server open for the connection-retry path, and that handle keeps the
  // event loop alive. Skip this and your script prints its output and then
  // hangs forever instead of exiting.
  await solari.close()
}
