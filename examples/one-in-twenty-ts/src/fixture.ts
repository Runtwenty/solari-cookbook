/**
 * Tiny checkout fixture with a shipping/pay race.
 *
 * Changing shipping starts a delayed state update. Clicking Pay while that
 * update is still pending can leave checkout stuck on "Processing payment…"
 * or let a late shipping callback overwrite a completed payment.
 *
 * Under normal human timing the bug is intermittent, not guaranteed.
 * Pass 1 waits for shipping to settle before paying, so checkout should succeed.
 */
export const FIXTURE_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>One In Twenty Checkout</title>
  <style>
    body { font-family: sans-serif; max-width: 28rem; margin: 2rem auto; line-height: 1.4; }
    label, button, select { font-size: 1rem; }
    #status { padding: 0.5rem 0.75rem; border: 1px solid #ccc; }
    #status[data-state="paid"] { border-color: #0a0; }
    #status[data-state="error"], #status[data-state="paying"] { border-color: #a40; }
  </style>
</head>
<body>
  <h1>One In Twenty</h1>
  <p id="product">Test Widget — $20</p>
  <label>
    Shipping
    <select id="shipping">
      <option value="standard">Standard — $5</option>
      <option value="express">Express — $15</option>
    </select>
  </label>
  <p>Shipping: <span id="shipping-cost">$5</span></p>
  <p>Total: <span id="total">$25</span></p>
  <button id="pay" type="button">Pay</button>
  <p id="status" data-state="ready">Ready</p>
  <script>
    const PRODUCT = 20;
    const RATES = { standard: 5, express: 15 };
    let shipping = "standard";
    let shippingCost = 5;
    let pending = 0;
    const statusEl = document.getElementById("status");

    function setStatus(state, text) {
      statusEl.dataset.state = state;
      statusEl.textContent = text;
    }

    function render() {
      document.getElementById("shipping-cost").textContent = "$" + shippingCost;
      document.getElementById("total").textContent = "$" + (PRODUCT + shippingCost);
    }

    document.getElementById("shipping").addEventListener("change", (event) => {
      const next = event.target.value;
      pending += 1;
      setStatus("shipping", "Updating shipping…");
      const delay = 250 + Math.floor(Math.random() * 650);
      setTimeout(() => {
        pending -= 1;
        shipping = next;
        shippingCost = RATES[next];
        render();
        // Stale shipping completion can clobber a finished payment.
        if (statusEl.dataset.state === "paid") {
          setStatus("error", "Shipping update overwrote paid checkout");
          return;
        }
        if (pending === 0 && statusEl.dataset.state !== "paying") {
          setStatus("ready", "Shipping ready");
        }
      }, delay);
    });

    document.getElementById("pay").addEventListener("click", () => {
      if (statusEl.dataset.state === "paid") return;
      const capturedShipping = shipping;
      const capturedCost = shippingCost;
      setStatus("paying", "Processing payment…");
      setTimeout(() => {
        if (pending > 0) {
          // Intermittent: sometimes the pay never leaves the loading state.
          setStatus("paying", "Processing payment…");
          return;
        }
        setStatus(
          "paid",
          "Paid " + capturedShipping + " $" + (PRODUCT + capturedCost),
        );
      }, 80);
    });
  </script>
</body>
</html>
`;
