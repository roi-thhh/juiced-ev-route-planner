"""
Automated Browser Interception & Extraction Module for Bolt.Earth Chargers.
Uses Playwright to intercept JSON API payloads with network listeners and a bounded grid sweep.
"""

import asyncio
import json
import logging
import time
from typing import Dict, Any, List, Set
from playwright.async_api import async_playwright, Response

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Bounding box covering Kerala and Tamil Nadu
LAT_MIN = 8.0
LAT_MAX = 13.5
LNG_MIN = 75.0
LNG_MAX = 80.5
GRID_STEP = 1.0  # 1.0 degree cells provide thorough coverage with zero clustering at zoom 18
DISCOVERY_ENDPOINT_KEYWORD = "api.bolt.earth/discovery/v1/chargers/clusters"


class BoltEarthScraper:
    def __init__(self, headless: bool = True):
        self.headless = headless
        self.intercepted_records: Dict[str, Dict[str, Any]] = {}
        self.total_responses_intercepted = 0
        self.api_call_history: List[Dict[str, Any]] = []

    async def _handle_response(self, response: Response):
        """
        Network response listener to intercept JSON payloads from Bolt.Earth discovery endpoints.
        """
        url = response.url
        if DISCOVERY_ENDPOINT_KEYWORD in url:
            self.total_responses_intercepted += 1
            try:
                status = response.status
                if status == 200:
                    payload = await response.json()
                    items = payload.get("data", [])
                    new_chargers = 0
                    new_clusters = 0
                    for item in items:
                        if item.get("properties", {}).get("cluster"):
                            new_clusters += 1
                        else:
                            # Unique charger key
                            cid = item.get("chargerId") or str(item.get("_id"))
                            if cid not in self.intercepted_records:
                                self.intercepted_records[cid] = item
                                new_chargers += 1

                    self.api_call_history.append({
                        "url": url,
                        "status": status,
                        "items_count": len(items),
                        "clusters": new_clusters,
                        "new_chargers": new_chargers,
                        "timestamp": time.time()
                    })
                    logger.info(f"Intercepted API response: {len(items)} items ({new_chargers} new chargers, {new_clusters} clusters). Total unique: {len(self.intercepted_records)}")
                else:
                    logger.warning(f"Intercepted non-200 response ({status}): {url}")
                    self.api_call_history.append({
                        "url": url,
                        "status": status,
                        "error": True,
                        "timestamp": time.time()
                    })
            except Exception as e:
                logger.error(f"Error parsing intercepted response from {url}: {e}")

    async def run_extraction(
        self,
        lat_min: float = LAT_MIN,
        lat_max: float = LAT_MAX,
        lng_min: float = LNG_MIN,
        lng_max: float = LNG_MAX,
        grid_step: float = GRID_STEP,
        zoom_level: int = 18,
        delay_seconds: float = 0.3
    ) -> List[Dict[str, Any]]:
        """
        Launches headless Chromium, navigates to Bolt.Earth, and executes a bounded grid sweep.
        """
        logger.info("Initializing Playwright headless Chromium browser...")
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=self.headless)
            context = await browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            )
            page = await context.new_page()

            # Attach network response listener
            page.on("response", self._handle_response)

            logger.info("Navigating to https://bolt.earth/ev-charger-near-me...")
            try:
                await page.goto("https://bolt.earth/ev-charger-near-me", wait_until="domcontentloaded", timeout=45000)
                # Wait briefly for initial map bootstrap
                await page.wait_for_timeout(3000)
            except Exception as e:
                logger.warning(f"Initial navigation notice: {e}. Proceeding with in-page discovery...")

            # Build grid bounding boxes
            lat_points = []
            cur_lat = lat_min
            while cur_lat < lat_max:
                lat_points.append(cur_lat)
                cur_lat += grid_step

            lng_points = []
            cur_lng = lng_min
            while cur_lng < lng_max:
                lng_points.append(cur_lng)
                cur_lng += grid_step

            total_cells = len(lat_points) * len(lng_points)
            logger.info(f"Starting bounded grid sweep: {len(lat_points)} lat bands x {len(lng_points)} lng bands = {total_cells} cells (Bounds: Lat {lat_min}-{lat_max}, Lng {lng_min}-{lng_max}) at zoom {zoom_level}...")

            cell_idx = 0
            for lat_b in lat_points:
                lat_t = min(lat_b + grid_step, lat_max)
                for lng_l in lng_points:
                    lng_r = min(lng_l + grid_step, lng_max)
                    cell_idx += 1

                    url = f"https://api.bolt.earth/discovery/v1/chargers/clusters?lat_bottom={lat_b}&lng_right={lng_r}&lat_top={lat_t}&lng_left={lng_l}&zoom={zoom_level}"
                    logger.debug(f"[{cell_idx}/{total_cells}] Querying cell: Lat [{lat_b}, {lat_t}], Lng [{lng_l}, {lng_r}]")

                    # Dispatch fetch through browser session
                    await page.evaluate(f"""
                        fetch('{url}', {{
                            headers: {{
                                'Accept': 'application/json, text/plain, */*',
                                'Origin': 'https://bolt.earth',
                                'Referer': 'https://bolt.earth/ev-charger-near-me'
                            }}
                        }}).catch(err => console.error(err))
                    """)

                    # Inter-query backoff to prevent rate-limiting
                    await asyncio.sleep(delay_seconds)

            # Also query the full macroscopic bounding box at high zoom to ensure no border boundaries were split
            full_box_url = f"https://api.bolt.earth/discovery/v1/chargers/clusters?lat_bottom={lat_min}&lng_right={lng_max}&lat_top={lat_max}&lng_left={lng_min}&zoom={zoom_level}"
            logger.info("Executing comprehensive envelope query across complete South India bounds...")
            await page.evaluate(f"""
                fetch('{full_box_url}', {{
                    headers: {{
                        'Accept': 'application/json, text/plain, */*',
                        'Origin': 'https://bolt.earth',
                        'Referer': 'https://bolt.earth/ev-charger-near-me'
                    }}
                }}).catch(err => console.error(err))
            """)
            await asyncio.sleep(2.0)

            logger.info(f"Extraction sweep finished. Total unique stations intercepted: {len(self.intercepted_records)}")
            await browser.close()

        return list(self.intercepted_records.values())


def run_scraper_sync(**kwargs) -> List[Dict[str, Any]]:
    """Synchronous wrapper for running the scraper."""
    scraper = BoltEarthScraper()
    return asyncio.run(scraper.run_extraction(**kwargs))


if __name__ == "__main__":
    records = run_scraper_sync()
    print(f"Intercepted {len(records)} raw stations.")
