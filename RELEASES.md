# 🚀 JUICED - Release History & Changelog

All notable changes to the **JUICED** Electric Two-Wheeler Highway Corridor Planner and Android Application are documented in this file.

---

## 🌟 [v1.2.0] — Standalone Android APK & Edge-to-Edge Full Screen Release
*Release Date: September 2026*

### 📱 Android Application Enhancements
- **Edge-to-Edge Full Screen (Zero White Borders)**:
  - Transitioned theme to dark `Theme.Material.NoActionBar` with a deep `#0C0D10` window background.
  - Enabled `android:windowLayoutInDisplayCutoutMode="shortEdges"`, allowing the app to bleed 100% seamlessly behind front-facing camera cutouts and curved display corners.
  - Removed `.systemBarsPadding()` in Jetpack Compose shell, rendering the map and bottom sheet control deck across the entire physical display.
  - Added CSS `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` support to ensure floating headers and touch drag handles respect system navigation zones.
- **Embedded Zero-Latency Offline Database**:
  - Packaged all 183 Bolt.Earth Type-6 fast charging stations into `chargers_data.js` for instant, CORS-immune offline initialization.
  - Enabled `allowFileAccessFromFileURLs` and `allowUniversalAccessFromFileURLs` in WebView settings.
- **On-Device Geodesic Corridor Routing**:
  - Implemented client-side highway corridor polygon generator (`buildCorridorPolygon`) for standalone routing without requiring a local Python server.
  - Resolved `coordinates` undefined error on application boot and route calculation.
  - Configured silent auto-crunch on initial boot so users are greeted directly with an active route without alert popups.
- **Official Launcher Branding**:
  - Generated adaptive and round launcher icons (`ic_launcher.png`, `ic_launcher_round.png`, `ic_launcher_foreground.png`) with vibrant Volt Yellow (`#FEE209`) and jagged black JUICED insignia across all standard DPI buckets (`mdpi`, `hdpi`, `xhdpi`, `xxhdpi`, `xxxhdpi`).

### 📦 Artifacts Included
- **`JUICED.apk`** (12.13 MB) — Direct installable standalone package for Android 8.0+.

---

## ⚡ [v1.1.0] — JUICED Semi-Brutalist Rebranding & Dual Map Engine
*Release Date: September 2026*

### 🎨 Visual & UI/UX Transformation
- **Brand Identity**: Complete evolution from *VoltPath* to **JUICED**, introducing high-voltage Volt Yellow (`#FFE600`), Cyber Mint (`#00FF9D`), and Hot Pink (`#FF3366`) neobrutalist styling.
- **Typography & Aesthetics**: Integrated `Syne`, `Space Grotesk`, and `Space Mono` typography with 2.5px chunky solid borders and hard offset dropshadows (`4px 4px 0px #000000`).
- **Interactive Bottom Sheet**: Added a spring physics draggable bottom sheet control deck with multi-tier expand/collapse states over the full-bleed map canvas.
- **High-Voltage Launch Splash**: Created an animated splash screen featuring a pulsing halftone background, retro diagnostic ticker, animated hazard stripes progress bar, and instant skip control.

### 🗺️ Dual Map Engine Architecture
- **Google Maps JavaScript API Integration**: Integrated native Night Highway dark-mode Google Maps with live traffic compatibility and direct turn-by-turn navigation deep links (`google_maps_nav_url`).
- **One-Click Engine Toggle**: Added an in-header pill badge allowing riders to toggle between Google Maps and OpenStreetMap / CARTO Dark on the fly.
- **Failover Security**: Added automatic authentication and billing failover (`gm_authFailure`) that gracefully returns to Leaflet without blocking user planning.

---

## 🔌 [v1.0.0] — Initial Corridor Optimization & Data Pipeline Release
*Release Date: September 2026*

### 🛠️ Core Engine & Network Extraction
- **Bolt.Earth Type-6 Scraper**: Built an automated network extraction pipeline querying 183 validated Type-6 EV fast chargers across South India (Kerala, Tamil Nadu, and Karnataka).
- **FastAPI Corridor Engine**:
  - Geodesic route buffer modeling using `shapely` geometric polygons.
  - Direct highway corridor stations classification vs. off-corridor detour penalties (`detour_penalty_km`, `detour_penalty_min`).
- **Battery SoC & Stop Optimizer**:
  - Implemented realistic battery state-of-charge discharge modeling for prominent Indian electric two-wheelers (Ather 450X, Ola S1 Pro, TVS iQube, Vida V1 Pro, Chetak, Simple One, Ultraviolette F77).
  - Calculated optimal stop sequences, energy added (`kWh`), and top-up charging durations.
- **Export Utility**: Generated KML (`data/bolt_type6_chargers.kml`) and CSV datasets for Google My Maps import.
