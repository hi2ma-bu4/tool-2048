import asyncio
from playwright.async_api import async_playwright, expect
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        file_path = os.path.abspath("index.html")
        await page.goto(f"file://{file_path}")

        # Give the page a moment to load and render
        await page.wait_for_timeout(1000)

        # Scroll the grid into view and click
        grid_cell_0_0 = page.locator('.grid-cell[data-row="0"][data-col="0"]')
        await grid_cell_0_0.scroll_into_view_if_needed()
        await grid_cell_0_0.click()

        grid_cell_1_0 = page.locator('.grid-cell[data-row="1"][data-col="0"]')
        await grid_cell_1_0.scroll_into_view_if_needed()
        await grid_cell_1_0.click()

        # Give a moment for the state to update
        await page.wait_for_timeout(500)

        # Use keyboard to merge them
        await page.press("body", "ArrowUp")

        # Give a moment for the state to update
        await page.wait_for_timeout(500)

        # Click the calculate button
        calculate_button = page.locator("#calculate-btn")
        await calculate_button.scroll_into_view_if_needed()
        await calculate_button.click()

        # Wait for a recommendation to appear
        await page.wait_for_timeout(2000) # Wait for AI calculation

        screenshot_path = "jules-scratch/verification/verification.png"
        await page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())