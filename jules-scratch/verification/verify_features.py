import asyncio
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Navigate to the local HTML file
        await page.goto(f"file://{os.path.abspath('index.html')}")

        # Verify the new settings are visible
        await expect(page.locator("#auto-add-tile-checkbox")).to_be_visible()
        await expect(page.locator("#merge-limit-input")).to_be_visible()
        await expect(page.locator("#ai-auto-play-btn")).to_be_visible()
        await expect(page.locator("#ai-interval-input")).to_be_visible()

        # Interact with the new settings
        await page.uncheck("#auto-add-tile-checkbox")
        await page.fill("#merge-limit-input", "1024")
        await page.click("#ai-auto-play-btn")

        # Take a screenshot
        await page.screenshot(path="jules-scratch/verification/verification.png")

        await browser.close()

if __name__ == "__main__":
    import os
    asyncio.run(main())