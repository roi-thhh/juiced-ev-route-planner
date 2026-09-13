<div align="center">

  <img src="public/juiced_logo.png" alt="JUICED Logo" width="130" height="130" style="border-radius: 26px; border: 3px solid #000000; box-shadow: 6px 6px 0px #000000;" />

  # ⚡ JUICED
  ### Electric Two-Wheeler Highway Corridor Planner & Battery SoC Optimizer

  [![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20Web-FFE600?style=for-the-badge&logo=android&logoColor=black)](#-android-apk)
  [![Python](https://img.shields.io/badge/Python-3.10%2B-00FF9D?style=for-the-badge&logo=python&logoColor=black)](#-fastapi-backend-quickstart)
  [![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-FF3366?style=for-the-badge&logo=fastapi&logoColor=white)](#-api-documentation)
  [![License](https://img.shields.io/badge/License-MIT-2E5BFF?style=for-the-badge&logo=open-source-initiative&logoColor=white)](LICENSE)
  [![Network](https://img.shields.io/badge/Bolt.Earth%20Type--6-183%20Stations-FFE600?style=for-the-badge&logo=lightning&logoColor=black)](#-network-coverage)

  <p align="center">
    <strong>Crush range anxiety on two wheels.</strong> Plan multi-stop long-distance highway road trips with verified <strong>Bolt.Earth Type-6 Fast Chargers</strong>, real-time corridor buffering, detour penalty calculations, and battery State-of-Charge (SoC) predictions.
  </p>

  <p align="center">
    <a href="#-key-features">Key Features</a> •
    <a href="#-android-apk">Android APK</a> •
    <a href="#-fastapi-backend-quickstart">Quickstart</a> •
    <a href="#-supported-vehicles">Vehicles</a> •
    <a href="#-api-documentation">API Docs</a> •
    <a href="#-architecture">Architecture</a> •
    <a href="RELEASES.md">Releases</a>
  </p>

</div>

---

## 📸 Interface Preview

<div align="center">
  <img src="public/juiced_logo.png" width="30" height="30" /> <em>Semi-Brutalist & Funky UI with Hard Offset Dropshadows, Volt Accents, and Interactive Bottom Deck</em>
</div>

<br />

| Launch Loading Deck | Calculated Itinerary & Map | Mobile Android Shell |
|:---:|:---:|:---:|
| <img src="public/juiced_logo.png" width="220" /> | <img src="public/juiced_logo.png" width="220" /> | <img src="public/juiced_logo.png" width="220" /> |

---

## ⚡ Key Features

- **🗺️ Dual Map Engine (Google Maps + Leaflet)**:
  - Toggle between **Native Google Maps JavaScript API (Night Highway Dark Theme)** and **Standard OpenStreetMap / CARTO Dark**.
  - Direct turn-by-turn navigation deep links straight into the Google Maps app with all waypoint stops pre-populated.
  - Automatic authentication/billing failover that preserves user progress without crashing.

- **🛣️ Geodesic Highway Corridor Buffering**:
  - Mathematical route buffering (`shapely`) identifies stations situated directly along the highway corridor.
  - Off-highway stations within detour reach are calculated with geodesic distance and estimated time penalties.

- **🔋 Battery SoC Simulation & Stop Optimizer**:
  - Continuous battery state-of-charge calculation accounting for usable range, reserve safety buffers (10%–25%), and charging station power output.
  - Sequences required charging stops and computes estimated top-up times to 85% SoC.

- **📱 Standalone Android Application (Edge-to-Edge Full Screen)**:
  - Packaged into a direct-install APK (`JUICED.apk`) built with Jetpack Compose & Android WebView.
  - Full display cutout mode (`shortEdges`) filling 100% of modern phone screens behind camera punch-holes and rounded corners.
  - Embedded offline database of all 183 Bolt.Earth stations for zero-latency on-device route calculations without requiring an external server.

- **🎨 Semi-Brutalist & Funky Visual Aesthetics**:
  - High-voltage palette: Volt Yellow (`#FFE600`), Cyber Mint (`#00FF9D`), Hot Pink (`#FF3366`), and Klein Blue (`#2E5BFF`).
  - Chunky tactile cards, hard offset dropshadows, tactile button feedback, and spring-physics bottom sheet deck.

---

## 📱 Android APK

You can install and run **JUICED** directly on any Android phone without needing a developer environment or backend server:

👉 **[Download JUICED.apk (v1.2.0)](JUICED.apk)** `12.13 MB`

### How to Install:
1. Transfer `JUICED.apk` to your phone via USB, Google Drive, WhatsApp, or Telegram.
2. Open the file on your device and tap **Install** (enable *"Install unknown apps"* if prompted).
3. Open **JUICED** and start planning your EV highway ride.

---

## 🏍️ Supported Vehicles

| Model | Battery Capacity | Usable Range | Max Charge Rate | Default Efficiency |
|:---|:---:|:---:|:---:|:---:|
| **Ather 450X (Gen 3)** | 3.7 kWh | 105 km | 3.3 kW | 26.5 Wh/km |
| **Ola S1 Pro (Gen 2)** | 4.0 kWh | 140 km | 3.3 kW | 28.5 Wh/km |
| **TVS iQube S** | 3.04 kWh | 90 km | 3.3 kW | 25.0 Wh/km |
| **Vida V1 Pro** | 3.94 kWh | 110 km | 3.3 kW | 27.2 Wh/km |
| **Bajaj Chetak Premium** | 3.2 kWh | 95 km | 3.3 kW | 26.0 Wh/km |
| **Simple One** | 5.0 kWh | 190 km | 3.3 kW | 26.3 Wh/km |
| **Ultraviolette F77 Mach 2** | 10.3 kWh | 230 km | 6.6 kW | 44.8 Wh/km |
| **Custom EV** | Configurable | User-specified | 3.3 kW - 10 kW | Variable |

---

## 💻 FastAPI Backend Quickstart

### Prerequisites
- Python 3.10 or higher
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/juiced-ev-route-planner.git
cd juiced-ev-route-planner
```

### 2. Set Up Virtual Environment
```bash
# Windows
python -m venv venv
.\venv\Scripts\activate

# Linux / macOS
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. (Optional) Configure Google Maps API Key
Copy the example environment file:
```bash
cp .env.example .env
```
Open `.env` and paste your Google Cloud API key if you want to use the native Google Maps engine:
```env
GOOGLE_MAPS_API_KEY=AIzaSyYourKeyHere
```
*(Note: If omitted, JUICED runs seamlessly on the open-source Leaflet / OSM engine without requiring any API key.)*

### 5. Launch the Server
```bash
python -m uvicorn src.app:app --host 127.0.0.1 --port 8000 --reload
```
Open your browser at **`http://localhost:8000/`**.

---

## 🛠️ Building Android APK from Source

```bash
cd android
# Windows PowerShell
.\gradlew.bat assembleDebug

# Linux / macOS
./gradlew assembleDebug
```
The compiled APK will be output at:
`android/app/build/outputs/apk/debug/app-debug.apk`

---

## 🔌 API Documentation

Once the server is running, interactive Swagger API docs are accessible at **`http://localhost:8000/docs`**.

### Core Endpoints

#### `POST /api/route/plan`
Calculates optimal corridor charging itinerary between two coordinates.

```json
{
  "origin": [9.9312, 76.2673],
  "destination": [11.0168, 76.9558],
  "ev_model": "ather_450x",
  "start_soc": 90.0,
  "reserve_soc": 15.0,
  "corridor_width_km": 3.0,
  "detour_search_radius_km": 12.0,
  "power_filter_kw": null
}
```

#### `GET /api/chargers`
Returns all verified Bolt.Earth Type-6 charging stations across Kerala, Tamil Nadu, and Karnataka.

#### `GET /api/ev-profiles`
Returns specifications and charging curves for all supported electric motorcycles and scooters.

---

## 🏗️ Architecture

```
JUICED
├── android/                   # Native Android Project (Jetpack Compose + WebView Shell)
│   ├── app/src/main/assets/   # Bundled offline web app, styles, scripts, and stations
│   └── app/src/main/res/      # Adaptive & legacy launcher icons and dark themes
├── data/                      # Validated South India charging network datasets
│   ├── bolt_type6_south_india.json     # Primary station repository (183 stations)
│   └── bolt_type6_chargers.kml         # Google Earth & My Maps GIS export
├── docs/                      # Technical implementation specs and Google Maps guide
├── public/                    # Frontend Web Assets (Semi-Brutalist & Funky UI)
│   ├── app.js                 # Dual engine router, OSRM client, and DOM controller
│   ├── chargers_data.js       # Bundled zero-latency station database
│   ├── index.html             # Full-bleed semantic app canvas & bottom sheet deck
│   ├── juiced_logo.png        # Official brand graphic insignia
│   └── styles.css             # Semi-brutalist design system & responsive layout
├── scripts/                   # Automation, asset synchronization, and icon pipelines
├── src/                       # Python FastAPI Backend Engine
│   ├── app.py                 # REST API router and static file server
│   └── router.py              # Geodesic corridor buffering & SoC optimizer
├── JUICED.apk                 # Standalone compiled Android APK (v1.2.0)
├── requirements.txt           # Python dependency manifest
└── README.md                  # Project documentation
```

---

## 🤝 Contributing

Contributions, feature requests, and bug reports are warmly welcome!
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: Add AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

<div align="center">
  <sub>Built with ⚡ for the electric motorcycle and scooter community.</sub>
</div>
