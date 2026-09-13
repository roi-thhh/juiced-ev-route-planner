# Phase 1 Data Summary: Bolt.Earth Type-6 DC Fast Charging Network

**Target Region**: Kerala and Tamil Nadu, India  
**Bounding Box**: Latitude 8.0° N to 13.5° N, Longitude 75.0° E to 80.5° E  
**Target Connector Standard**: Type-6 DC Fast Chargers (IS 17017-2-6 / Light EV DC Fast Charging)  
**Operator**: Bolt.Earth  
**Pipeline Execution Mode**: Automated Headless Chromium Interception (Playwright) + Bounded Grid Sweep  

---

## 1. Executive Summary & Station Discovery Counts

| Metric | Count | Details |
| :--- | :--- | :--- |
| **Total Raw Stations Intercepted in Bounding Box** | **1625** | All charger models and power ratings |
| **Total Type-6 DC Fast Stations in Bounding Box** | **242** | Strict model filter for 2WFC Type-6 units |
| **Kerala Type-6 Stations** | **171** | Classified via official Kerala state polygon & pincodes |
| **Tamil Nadu Type-6 Stations** | **12** | Classified via official Tamil Nadu state polygon & pincodes |
| **Combined Target Set (Kerala + TN)** | **183** | Available in `data/bolt_type6_south_india.geojson` |
| **Adjacent Border Stations (Karnataka/Puducherry)** | **59** | E.g. Bengaluru, Mysuru, Puducherry border corridor |

---

## 2. Technical Findings: Bolt.Earth API & Filtering Architecture

### 2.1 API Endpoint & Filtering Mechanism
- **Discovery Endpoint**: `https://api.bolt.earth/discovery/v1/chargers/clusters`
- **Query Parameters**:
  - `lat_bottom`, `lng_left`, `lat_top`, `lng_right`: Geographic bounding box.
  - `zoom`: Map zoom level (Integer between 4 and 18).
- **Server-Side vs. Client-Side Filtering**:
  - **No server-side filtering parameter** exists in the API for connector types (`connector`, `type`, or `vehicle`).
  - All charging sockets (universal 16A Lite, Level-1 AC, Level-2 AC, Level-3 CCS2, and Type-6 DC Fast) are returned in the response payload.
  - **Filtering occurs client-side**: The front-end distinguishes chargers using the `modelId` attribute in the `model` object.

### 2.2 Model Classification for Type-6 Two-Wheeler Fast Chargers
Through systematic inspection of all model identifiers across South India and nationwide payloads, the following Type-6 models were identified:

| Model ID | Count (KL + TN) | Power (kW) | Description |
| :--- | :--- | :--- | :--- |
| `OCPP_2WFC_1_3KW_TYPE6_TYPE7_SIM` | 171 | 3.3 kW | Dual Type-6 DC + Type-7 AC |
| `OCPP_2WFC_1_3KW_TYPE6_TYPE7_WIFI` | 8 | 3.3 kW | Dual Type-6 DC + Type-7 AC |
| `OCPP_2WFC_1_3KW_TYPE6_SIM` | 1 | 3.3 kW | Dedicated Type-6 DC Fast |
| `OCPP_2WFC_1_6KW_TYPE6_TYPE7_WIFI` | 1 | 6.6 kW | Dual Type-6 DC + Type-7 AC |
| `OCPP_2WFC_1_10KW_TYPE6_SIM` | 1 | 10.0 kW | Dedicated Type-6 DC Fast |
| `OCPP_2WFC_1_6KW_TYPE6_SIM` | 1 | 6.6 kW | Dedicated Type-6 DC Fast |

### 2.3 Power Rating Distribution
- **3.3 kW Chargers**: 180 stations (98.4%) — Standard 1-phase LEV DC fast charging rate.
- **6.6 kW Chargers**: 2 stations (1.1%) — High-speed two-wheeler charging hubs.
- **10.0 kW Chargers**: 1 stations (0.5%) — Ultra-fast two-wheeler multi-point fast charger.

---

## 3. Geographic Distribution & Key Hubs

### 3.1 Kerala (171 Stations)
Top Identified Hubs:
- **Kozhikode**: ~10 fast chargers
- **Thrissur**: ~10 fast chargers
- **Calicut**: ~9 fast chargers
- **Malappuram**: ~8 fast chargers
- **Alappuzha**: ~4 fast chargers
- **Palakkad**: ~3 fast chargers
- **Thiruvananthapuram**: ~2 fast chargers
- **Trivandrum**: ~2 fast chargers

### 3.2 Tamil Nadu (12 Stations)
Top Identified Hubs:
- **Erode**: ~1 fast chargers

---

## 4. Missing Fields & API Rate-Limit Observations

1. **Station Name Field**:
   - The Bolt.Earth discovery payload frequently omits a dedicated `station.name` key, providing only `station.address` and `chargerId`.
   - **Resolution**: Our normalization pipeline cleanly parses landmark and business names from the address string (e.g. `Chirayil Ultra Charging Station`, `RJ EV HUB`, `SK VOLT HUB`), falling back to `Bolt.Earth Station <ID>`.
2. **Real-Time Operational Status**:
   - The cluster discovery endpoint returns active network stations. Dynamic telemetry (e.g., in-session vs idle) is not exposed in public cluster pings; stations are mapped to `"AVAILABLE"` status with full raw metadata preserved in `raw_meta`.
3. **Rate Limits & Throttling**:
   - The bounded grid sweep implemented a 250ms inter-query interval with `zoom=18`. Zero rate limits (429 Too Many Requests), captchas, or IP blocks were encountered. All queries responded with HTTP 200 OK.

---

## 5. Recommendations for Periodic Data Refresh & Caching Strategy

For **Phase 2 (Corridor Routing & Detour Penalties)** and production maintenance:

1. **Local Spatial Index (R-Tree / GeoJSON Cache)**:
   - Load `data/bolt_type6_south_india.geojson` into a memory-mapped spatial index (e.g., `rtree` / `STRtree` in Python or `rbush` / `flatbush` in Node).
   - This enables sub-millisecond bounding box and nearest-neighbor lookups along active route corridors without hitting remote APIs during routing calculations.
2. **Automated Refresh Cadence (Cron / Scheduled Worker)**:
   - **Static Station Registry**: Bolt.Earth station deployments update weekly/monthly. A scheduled CI or background job run once every 24–48 hours is optimal to detect newly commissioned chargers.
   - **Delta Ingestion**: Compare incoming `chargerId` sets against existing GeoJSON to append new stations without redownloading unchanged metadata.
3. **Detour Corridor Buffer**:
   - For interstate routes (e.g., Kochi to Coimbatore, Chennai to Madurai, Thiruvananthapuram to Kanyakumari), create a 5 km – 10 km corridor polygon buffer around the planned polyline.
   - Query the local spatial index for Type-6 chargers within the buffer to calculate deviation distance and added travel time.

---

## 6. Generated Deliverables

- **GeoJSON**: [`data/bolt_type6_south_india.geojson`](file:///g:/programss/ev%20carging%20network%20app/data/bolt_type6_south_india.geojson) (Valid RFC 7946 FeatureCollection)
- **JSON**: [`data/bolt_type6_south_india.json`](file:///g:/programss/ev%20carging%20network%20app/data/bolt_type6_south_india.json) (Clean normalized dataset)
- **Raw Archive**: [`data/bolt_all_south_india_raw.json`](file:///g:/programss/ev%20carging%20network%20app/data/bolt_all_south_india_raw.json)
