/**
 * Port preview — expose a server running inside the sandbox on a public URL.
 *
 * Handy for previewing something an agent just built: start the dev server in
 * the VM, hand the URL to a human (or fetch it yourself). The URL is served
 * from *.preview.getsolari.com and is reachable from the open internet.
 */
import "dotenv/config"
import { SolariClient } from "@solarisdk/sdk"

const apiKey = process.env.SOLARI_API_KEY
if (!apiKey) {
  console.error("SOLARI_API_KEY is not set — copy .env.example to .env and paste your key (https://console.getsolari.com)")
  process.exit(1)
}
const pt = new SolariClient({ apiKey })
const PORT = 3000

const sandbox = await pt.sandboxes.create({ template: "base", timeoutMs: 5 * 60_000 })
try {
  await sandbox.connect()

  await sandbox.files.write(
    "/tmp/site/index.html",
    "<h1>Served from inside a Solari sandbox</h1>\n",
  )

  // Background it with a shell — `commands.run` waits for the process to exit,
  // so running a server in the foreground would block until the idle timeout.
  await sandbox.commands.run("sh", {
    args: ["-c", `cd /tmp/site && nohup python3 -m http.server ${PORT} >/dev/null 2>&1 &`],
  })

  const { url } = await sandbox.previewUrl(PORT)
  console.log("preview:", url)

  // Prove it's really public: fetch it from *here*, outside the VM. The first
  // attempts can be refused while the tunnel warms up — fetch throws on a
  // refused connection, so treat a throw like any other not-ready signal.
  let served = false
  for (let i = 0; i < 10 && !served; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    try {
      const res = await fetch(url)
      if (!res.ok) {
        console.log(`  waiting for the server (HTTP ${res.status})`)
        continue
      }
      console.log("fetched:", (await res.text()).trim())
      served = true
    } catch {
      console.log("  waiting for the server (not reachable yet)")
    }
  }
  if (!served) {
    throw new Error(`preview never became reachable — is the server really listening on port ${PORT}?`)
  }
} finally {
  await sandbox.kill()
}
