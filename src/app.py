"""
FastAPI Backend Application for EV Route Planner.
Serves routing corridor analysis, detour calculations, charging stop optimization,
and the frontend web client.
"""

import os
import sys
import json
import urllib.request
import urllib.parse
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Ensure project root is on sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from src.router import RouteCorridorEngine, EV_PROFILES

app = FastAPI(
    title="EV Route Planner - Two-Wheeler Fast Charging Corridor",
    description="Route planner with Type-6 DC Fast Charger detection and detour penalties across Kerala and Tamil Nadu.",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize corridor engine
engine = RouteCorridorEngine("data/bolt_type6_south_india.json")

# Load .env configuration if present
ENV_PATH = os.path.join(PROJECT_ROOT, ".env")
def get_env_config():
    config = {}
    if os.path.exists(ENV_PATH):
        try:
            with open(ENV_PATH, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        config[k.strip()] = v.strip().strip("'\"")
        except Exception:
            pass
    return config

def get_google_maps_api_key():
    env_cfg = get_env_config()
    return os.environ.get("GOOGLE_MAPS_API_KEY") or env_cfg.get("GOOGLE_MAPS_API_KEY") or ""


@app.get("/api/config")
def get_app_config():
    """Returns application configuration including Google Maps key status."""
    key = get_google_maps_api_key()
    is_prod = os.environ.get("ENV_MODE", "").lower() == "production"
    return {
        "has_google_maps_key": bool(key),
        "google_maps_api_key": key if key else None,
        "is_production": is_prod
    }


class SaveKeyRequest(BaseModel):
    api_key: str = Field(..., min_length=10, description="Google Cloud API Key")


@app.post("/api/config/key")
def save_google_maps_key(req: SaveKeyRequest):
    """Saves Google Maps API key to .env for persistent testing/production."""
    clean_key = req.api_key.strip()
    try:
        lines = []
        if os.path.exists(ENV_PATH):
            with open(ENV_PATH, "r", encoding="utf-8") as f:
                lines = [l for l in f if not l.startswith("GOOGLE_MAPS_API_KEY=")]
        lines.append(f"GOOGLE_MAPS_API_KEY={clean_key}\n")
        with open(ENV_PATH, "w", encoding="utf-8") as f:
            f.writelines(lines)
        os.environ["GOOGLE_MAPS_API_KEY"] = clean_key
        return {"success": True, "message": "Google Maps API Key saved successfully to .env"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write to .env: {str(e)}")


class RoutePlanRequest(BaseModel):
    origin: List[float] = Field(..., description="[latitude, longitude] of origin")
    destination: List[float] = Field(..., description="[latitude, longitude] of destination")
    ev_model: str = Field(default="ather_450x", description="EV profile key or 'custom'")
    custom_range_km: Optional[float] = Field(default=None, description="Custom range if model is custom")
    start_soc: float = Field(default=90.0, ge=10.0, le=100.0, description="Initial State of Charge (%)")
    reserve_soc: float = Field(default=15.0, ge=5.0, le=40.0, description="Minimum battery safety reserve (%)")
    corridor_width_km: float = Field(default=3.0, ge=0.5, le=15.0, description="Corridor buffer width (km)")
    detour_search_radius_km: float = Field(default=12.0, ge=3.0, le=25.0, description="Max search radius for detours (km)")
    power_filter_kw: Optional[float] = Field(default=None, description="Optional filter: 3.3, 6.6, or 10.0 kW")


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "stations_count": len(engine.stations),
        "supported_models": list(EV_PROFILES.keys())
    }


@app.get("/api/ev-profiles")
def get_ev_profiles():
    """Returns all pre-configured two-wheeler EV profiles."""
    return EV_PROFILES


@app.get("/api/chargers")
def get_chargers(
    state: Optional[str] = Query(None, description="Filter by state: Kerala or Tamil Nadu"),
    min_power_kw: Optional[float] = Query(None, description="Minimum power rating in kW")
):
    """Returns the Type-6 charging stations dataset."""
    results = engine.stations
    if state:
        results = [s for s in results if s["state"].lower() == state.lower()]
    if min_power_kw:
        results = [s for s in results if (s.get("power_kw") or 3.3) >= min_power_kw]
    return {
        "count": len(results),
        "chargers": results
    }


@app.get("/api/geocode")
def geocode_places(q: str = Query(..., min_length=2, description="Place search query")):
    """
    Fast geocoding search for towns, cities, and landmarks in Kerala & Tamil Nadu via Photon API.
    """
    clean_q = q.strip()
    encoded_q = urllib.parse.quote(clean_q)
    # Bias towards South India (lat=10.5, lon=77.0)
    url = f"https://photon.komoot.io/api/?q={encoded_q}&lat=10.5&lon=77.0&limit=6"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'EVRoutePlannerApp/1.0'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            places = []
            for feat in data.get("features", []):
                p = feat.get("properties", {})
                coords = feat.get("geometry", {}).get("coordinates", [])
                if len(coords) >= 2:
                    lng, lat = coords[0], coords[1]
                    name_parts = [p.get("name")]
                    if p.get("city") and p.get("city") != p.get("name"):
                        name_parts.append(p.get("city"))
                    if p.get("state"):
                        name_parts.append(p.get("state"))
                    if p.get("country"):
                        name_parts.append(p.get("country"))
                    
                    label = ", ".join([str(x) for x in name_parts if x])
                    places.append({
                        "label": label,
                        "name": p.get("name"),
                        "city": p.get("city") or p.get("district"),
                        "state": p.get("state"),
                        "latitude": lat,
                        "longitude": lng
                    })
            return {"query": clean_q, "results": places}
    except Exception as e:
        # Fallback preset suggestions for Kerala & Tamil Nadu
        presets = [
            {"label": "Kochi, Kerala", "latitude": 9.9312, "longitude": 76.2673},
            {"label": "Coimbatore, Tamil Nadu", "latitude": 11.0168, "longitude": 76.9558},
            {"label": "Kozhikode (Calicut), Kerala", "latitude": 11.2588, "longitude": 75.7804},
            {"label": "Thrissur, Kerala", "latitude": 10.5276, "longitude": 76.2144},
            {"label": "Thiruvananthapuram, Kerala", "latitude": 8.5241, "longitude": 76.9366},
            {"label": "Madurai, Tamil Nadu", "latitude": 9.9252, "longitude": 78.1198},
            {"label": "Salem, Tamil Nadu", "latitude": 11.6643, "longitude": 78.1460},
            {"label": "Chennai, Tamil Nadu", "latitude": 13.0827, "longitude": 80.2707},
            {"label": "Palakkad, Kerala", "latitude": 10.7867, "longitude": 76.6548},
            {"label": "Alappuzha, Kerala", "latitude": 9.4981, "longitude": 76.3388},
            {"label": "Kottayam, Kerala", "latitude": 9.5916, "longitude": 76.5222}
        ]
        matched = [p for p in presets if clean_q.lower() in p["label"].lower()]
        return {"query": clean_q, "results": matched or presets[:5]}


@app.post("/api/route/plan")
def plan_ev_route(req: RoutePlanRequest):
    """
    Computes direct route, analyzes active corridor, calculates detour penalties,
    and returns optimized charging stops tailored to the EV rider's battery range.
    """
    if len(req.origin) < 2 or len(req.destination) < 2:
        raise HTTPException(status_code=400, detail="Invalid origin or destination coordinates.")

    origin_tuple = (req.origin[0], req.origin[1])
    dest_tuple = (req.destination[0], req.destination[1])

    try:
        corridor_data = engine.analyze_corridor(
            origin=origin_tuple,
            destination=dest_tuple,
            corridor_width_km=req.corridor_width_km,
            detour_search_radius_km=req.detour_search_radius_km
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute route corridor: {str(e)}")

    # Apply optional power rating filter if requested
    if req.power_filter_kw:
        corridor_data["direct_chargers"] = [
            c for c in corridor_data["direct_chargers"]
            if (c.get("power_kw") or 3.3) >= req.power_filter_kw
        ]
        corridor_data["detour_chargers"] = [
            c for c in corridor_data["detour_chargers"]
            if (c.get("power_kw") or 3.3) >= req.power_filter_kw
        ]

    # Calculate optimal charging stops
    stop_plan = engine.plan_charging_stops(
        corridor_analysis=corridor_data,
        ev_profile_key=req.ev_model,
        custom_range_km=req.custom_range_km,
        start_soc_percent=req.start_soc,
        reserve_soc_percent=req.reserve_soc
    )

    # Google Maps Directions Deep Link
    gmaps_waypoints = []
    for stop in stop_plan["recommended_stops"]:
        gmaps_waypoints.append(f"{stop['latitude']},{stop['longitude']}")
    
    gmaps_url = (f"https://www.google.com/maps/dir/?api=1"
                 f"&origin={origin_tuple[0]},{origin_tuple[1]}"
                 f"&destination={dest_tuple[0]},{dest_tuple[1]}")
    if gmaps_waypoints:
        gmaps_url += f"&waypoints={'%7C'.join(gmaps_waypoints)}"

    return {
        "success": True,
        "trip_summary": {
            "origin": origin_tuple,
            "destination": dest_tuple,
            "direct_distance_km": corridor_data["route"]["distance_km"],
            "direct_duration_min": corridor_data["route"]["duration_min"],
            "ev_profile": stop_plan["ev_profile"]["name"],
            "usable_range_km": stop_plan["usable_range_km"],
            "charging_stops_count": stop_plan["stops_count"],
            "total_charge_time_min": stop_plan.get("total_charge_time_min", 0),
            "direct_chargers_count": len(corridor_data["direct_chargers"]),
            "detour_chargers_count": len(corridor_data["detour_chargers"]),
            "google_maps_nav_url": gmaps_url
        },
        "route_geometry": {
            "type": "LineString",
            "coordinates": corridor_data["route"]["coordinates"]
        },
        "corridor_polygon": corridor_data["corridor_polygon_geojson"],
        "corridor_width_km": corridor_data["corridor_width_km"],
        "direct_chargers": corridor_data["direct_chargers"],
        "detour_chargers": corridor_data["detour_chargers"],
        "charging_plan": stop_plan
    }


# Mount static assets if public/ exists
public_dir = os.path.join(PROJECT_ROOT, "public")
if os.path.exists(public_dir):
    app.mount("/static", StaticFiles(directory=public_dir), name="static")

    @app.get("/")
    def serve_frontend():
        return FileResponse(os.path.join(public_dir, "index.html"))

    app.mount("/", StaticFiles(directory=public_dir, html=True), name="root_static")
