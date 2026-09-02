"""Browser quickstart — launch a cloud browser, open a page, read it, close.

`launch()` creates a session and connects a Playwright-compatible browser to it
in one call. Everything after that is ordinary Playwright: the browser just
happens to be running on Solari's infrastructure rather than your laptop.
"""

import asyncio
import os

from dotenv import load_dotenv
from solari_browser import Solari

load_dotenv()


async def main() -> None:
    api_key = os.environ.get("SOLARI_API_KEY")
    if not api_key:
        raise SystemExit(
            "SOLARI_API_KEY is not set — copy .env.example to .env and paste your key "
            "(https://console.getsolari.com)"
        )
    solari = Solari(api_key=api_key)

    # `browser.close()` also RELEASES the session. Closing the browser alone
    # would leave the slot held until the plan deadline, so use try/finally.
    browser = await solari.launch()
    try:
        page = await browser.new_page()
        await page.goto("https://example.com")

        print("title  :", await page.title())
        print("h1     :", await page.locator("h1").inner_text())
        print("session:", browser.id)
    finally:
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
