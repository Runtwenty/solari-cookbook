# Port preview (TypeScript)

Serve something from inside the sandbox on a public URL. Starts an HTTP server in the VM, gets a `*.preview.getsolari.com` URL, then fetches it from the open internet to prove it is reachable.

## Run

```bash
cd examples/sandbox-port-preview-ts
npm install
cp .env.example .env   # then paste your key from https://console.getsolari.com
npm start
```

Source: [`index.ts`](index.ts)
