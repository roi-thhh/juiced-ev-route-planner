"""
Geospatial Corridor Routing & Detour Penalty Engine for Two-Wheeler EVs.
Supports OSRM route computation, Shapely corridor buffering, detour penalty metrics,
and battery state-of-charge (SoC) charging stop optimization.
"""

import json
import math
import urllib.request
import urllib.parse
from typing import Dict, Any, List, Optional, Tuple
from shapely.geometry import Point, LineString, Polygon
from shapely.ops import nearest_points

# Approximate degree conversion around latitude 10° N (South India)
# 1 degree latitude ~= 110.6 km
# 1 degree longitude ~= 109.6 km
KM_PER_DEG_LAT = 110.6
KM_PER_DEG_LNG = 109.6

# Pre-configured Two-Wheeler EV Profiles
EV_PROFILES = {
    "ather_450x": {
        "name": "Ather 450X",
        "battery_kwh": 3.7,
        "usable_range_km": 105,
        "max_charge_rate_kw": 3.3,
        "efficiency_wh_km": 35.0
    },
    "ather_apex": {
        "name": "Ather 450 Apex",
        "battery_kwh": 3.7,
        "usable_range_km": 100,
        "max_charge_rate_kw": 3.3,
        "efficiency_wh_km": 37.0
    },
    "ola_s1_pro": {
        "name": "Ola S1 Pro Gen 2",
        "battery_kwh": 4.0,
        "usable_range_km": 140,
        "max_charge_rate_kw": 3.3,
        "efficiency_wh_km": 28.5
    },
    "simple_one": {
        "name": "Simple One",
        "battery_kwh": 5.0,
        "usable_range_km": 190,
        "max_charge_rate_kw": 3.3,
        "efficiency_wh_km": 26.3
    },
    "ultraviolette_f77": {
        "name": "Ultraviolette F77 Mach 2",
        "battery_kwh": 10.3,
        "usable_range_km": 230,
        "max_charge_rate_kw": 6.6,
        "efficiency_wh_km": 44.8
    }
}


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two points on Earth in km."""
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


class RouteCorridorEngine:
    def __init__(self, stations_geojson_path: str = "data/bolt_type6_south_india.json"):
        self.stations: List[Dict[str, Any]] = []
        try:
            with open(stations_geojson_path, "r", encoding="utf-8") as f:
                self.stations = json.load(f)
            print(f"[RouteCorridorEngine] Loaded {len(self.stations)} Type-6 stations from {stations_geojson_path}")
        except Exception as e:
            print(f"[RouteCorridorEngine] Warning: Could not load stations: {e}")

    def fetch_osrm_route(self, origin: Tuple[float, float], destination: Tuple[float, float]) -> Optional[Dict[str, Any]]:
        """
        Queries OSRM driving service.
        origin: (lat, lng), destination: (lat, lng)
        Returns: { 'distance_km': float, 'duration_min': float, 'coordinates': [[lng, lat], ...], 'polyline': ... }
        """
        # OSRM expects coordinates in lng,lat order
        url = (f"https://router.project-osrm.org/route/v1/driving/"
               f"{origin[1]:.6f},{origin[0]:.6f};{destination[1]:.6f},{destination[0]:.6f}"
               f"?overview=full&geometries=geojson")
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'EVRoutePlanner/2.0'})
            with urllib.request.urlopen(req, timeout=12) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                if data.get("code") == "Ok" and data.get("routes"):
                    route = data["routes"][0]
                    return {
                        "distance_km": round(route["distance"] / 1000.0, 2),
                        "duration_min": round(route["duration"] / 60.0, 1),
                        "coordinates": route["geometry"]["coordinates"]
                    }
        except Exception as e:
            print(f"[RouteCorridorEngine] OSRM query failed ({url}): {e}")

        # Fallback to straight-line route if OSRM is unreachable
        dist_km = haversine_distance_km(origin[0], origin[1], destination[0], destination[1])
        steps = max(10, int(dist_km / 5))
        coords = []
        for i in range(steps + 1):
            t = i / steps
            lat = origin[0] + t * (destination[0] - origin[0])
            lng = origin[1] + t * (destination[1] - origin[1])
            coords.append([lng, lat])
        return {
            "distance_km": round(dist_km, 2),
            "duration_min": round((dist_km / 45.0) * 60.0, 1),  # estimate at 45 km/h
            "coordinates": coords
        }

    def fetch_route_distance_and_time(self, waypoints: List[Tuple[float, float]]) -> Tuple[float, float]:
        """Calculates distance (km) and time (min) across a list of (lat, lng) waypoints via OSRM."""
        coords_str = ";".join(f"{pt[1]:.6f},{pt[0]:.6f}" for pt in waypoints)
        url = f"https://router.project-osrm.org/route/v1/driving/{coords_str}?overview=false"
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'EVRoutePlanner/2.0'})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                if data.get("code") == "Ok" and data.get("routes"):
                    r = data["routes"][0]
                    return round(r["distance"] / 1000.0, 2), round(r["duration"] / 60.0, 1)
        except Exception:
            pass

        # Fallback haversine sum
        total_dist = 0.0
        for i in range(len(waypoints) - 1):
            total_dist += haversine_distance_km(
                waypoints[i][0], waypoints[i][1],
                waypoints[i+1][0], waypoints[i+1][1]
            )
        return round(total_dist, 2), round((total_dist / 45.0) * 60.0, 1)

    def analyze_corridor(
        self,
        origin: Tuple[float, float],
        destination: Tuple[float, float],
        corridor_width_km: float = 2.0,
        detour_search_radius_km: float = 12.0
    ) -> Dict[str, Any]:
        """
        Plots the route, creates the active corridor polygon, separates on-corridor vs detour chargers,
        and calculates exact detour penalties (added distance and time).
        """
        route_data = self.fetch_osrm_route(origin, destination)
        if not route_data:
            raise ValueError("Could not compute route between origin and destination.")

        coords = route_data["coordinates"]  # [[lng, lat], ...]
        direct_dist_km = route_data["distance_km"]
        direct_duration_min = route_data["duration_min"]

        # Create Shapely LineString (coordinates in [lng, lat])
        route_line = LineString(coords)
        
        # Approximate degree buffer based on corridor width
        # At latitude ~10°, 1 km is roughly 0.0091 degrees
        buffer_degrees = corridor_width_km / 110.0
        corridor_polygon = route_line.buffer(buffer_degrees)

        # Also create detour search boundary polygon
        detour_buffer_degrees = detour_search_radius_km / 110.0
        detour_polygon = route_line.buffer(detour_buffer_degrees)

        # Precompute cumulative distance along route coordinates for accurate station projection
        cum_distances = [0.0]
        for i in range(1, len(coords)):
            seg_dist = haversine_distance_km(coords[i-1][1], coords[i-1][0], coords[i][1], coords[i][0])
            cum_distances.append(cum_distances[-1] + seg_dist)

        def project_distance_from_origin(lat: float, lng: float) -> float:
            """Estimates distance along route (in km from origin) for a given point."""
            p = Point(lng, lat)
            # Find closest coordinate index
            min_d = float('inf')
            best_idx = 0
            for i, c in enumerate(coords):
                d = (c[0] - lng)**2 + (c[1] - lat)**2
                if d < min_d:
                    min_d = d
                    best_idx = i
            return round(cum_distances[best_idx], 1)

        direct_chargers = []
        candidate_detours = []

        for station in self.stations:
            lat = station["latitude"]
            lng = station["longitude"]
            pt = Point(lng, lat)

            dist_to_route_km = route_line.distance(pt) * 110.0
            dist_from_origin_km = project_distance_from_origin(lat, lng)

            # Skip stations that are behind the origin or past destination by > 15 km
            if dist_from_origin_km < 0 or dist_from_origin_km > direct_dist_km + 15:
                continue

            station_summary = {
                **station,
                "distance_to_route_km": round(dist_to_route_km, 2),
                "distance_from_origin_km": dist_from_origin_km
            }

            if corridor_polygon.contains(pt) or dist_to_route_km <= corridor_width_km:
                station_summary["category"] = "DIRECT_ON_CORRIDOR"
                station_summary["detour_penalty_km"] = 0.0
                station_summary["detour_penalty_min"] = 0.0
                direct_chargers.append(station_summary)
            elif detour_polygon.contains(pt) or dist_to_route_km <= detour_search_radius_km:
                station_summary["category"] = "DETOUR_REQUIRED"
                candidate_detours.append(station_summary)

        # Sort direct chargers by distance from origin along route
        direct_chargers.sort(key=lambda x: x["distance_from_origin_km"])

        # Calculate detour penalties for candidate detour chargers
        candidate_detours.sort(key=lambda x: x["distance_to_route_km"])
        evaluated_detours = []

        for station in candidate_detours[:15]:
            s_lat = station["latitude"]
            s_lng = station["longitude"]
            dist_to_route_km = station["distance_to_route_km"]

            # Geometric road deviation model:
            # Traveling off the corridor to the charger and returning to the corridor
            # accounts for 2-way spur distance with 1.25 road circuity factor
            added_km = round(2.0 * dist_to_route_km * 1.25, 1)
            added_min = round((added_km / 35.0) * 60.0, 1)  # urban/spur road travel speed ~35 km/h

            detour_dist_km = round(direct_dist_km + added_km, 1)
            detour_dur_min = round(direct_duration_min + added_min, 1)

            # Detour branch point coordinates on route
            nearest_geom = nearest_points(route_line, Point(s_lng, s_lat))[0]
            branch_coords = [nearest_geom.y, nearest_geom.x]  # [lat, lng]

            station["detour_penalty_km"] = added_km
            station["detour_penalty_min"] = added_min
            station["total_trip_km_via_detour"] = detour_dist_km
            station["total_trip_min_via_detour"] = detour_dur_min
            station["branch_point"] = branch_coords
            evaluated_detours.append(station)

        # Sort detours by smallest detour distance penalty
        evaluated_detours.sort(key=lambda x: (x["detour_penalty_km"], x["distance_to_route_km"]))

        # Convert corridor polygon to GeoJSON coordinates for frontend visual envelope
        poly_coords = []
        if isinstance(corridor_polygon, Polygon):
            poly_coords = [list(corridor_polygon.exterior.coords)]
        elif corridor_polygon.geom_type == 'MultiPolygon':
            poly_coords = [list(p.exterior.coords) for p in corridor_polygon.geoms]

        return {
            "route": {
                "distance_km": direct_dist_km,
                "duration_min": direct_duration_min,
                "coordinates": coords
            },
            "corridor_polygon_geojson": {
                "type": "Polygon" if isinstance(corridor_polygon, Polygon) else "MultiPolygon",
                "coordinates": poly_coords
            },
            "corridor_width_km": corridor_width_km,
            "direct_chargers": direct_chargers,
            "detour_chargers": evaluated_detours
        }

    def plan_charging_stops(
        self,
        corridor_analysis: Dict[str, Any],
        ev_profile_key: str = "ather_450x",
        custom_range_km: Optional[float] = None,
        start_soc_percent: float = 90.0,
        reserve_soc_percent: float = 15.0
    ) -> Dict[str, Any]:
        """
        Simulates two-wheeler battery consumption and selects optimal charging stops along the route.
        """
        route_dist_km = corridor_analysis["route"]["distance_km"]
        direct_chargers = corridor_analysis["direct_chargers"]
        detour_chargers = corridor_analysis["detour_chargers"]

        profile = EV_PROFILES.get(ev_profile_key, EV_PROFILES["ather_450x"])
        usable_range_km = custom_range_km if custom_range_km else profile["usable_range_km"]
        battery_kwh = profile.get("battery_kwh", 3.7)

        # Initial available range in km from start_soc down to reserve_soc
        effective_range_km = usable_range_km * max(0.0, (start_soc_percent - reserve_soc_percent) / 100.0)
        full_safe_leg_km = usable_range_km * max(0.0, (90.0 - reserve_soc_percent) / 100.0)

        recommended_stops = []
        soc_progression = [{
            "location": "Origin",
            "distance_km": 0.0,
            "battery_percent": start_soc_percent,
            "is_charge_stop": False
        }]

        # If full route is achievable without charging
        if route_dist_km <= effective_range_km:
            arrival_soc = max(0.0, round(start_soc_percent - (route_dist_km / usable_range_km * 100.0), 1))
            soc_progression.append({
                "location": "Destination",
                "distance_km": route_dist_km,
                "battery_percent": arrival_soc,
                "is_charge_stop": False
            })
            return {
                "needs_charging": False,
                "ev_profile": profile,
                "usable_range_km": usable_range_km,
                "stops_count": 0,
                "recommended_stops": [],
                "soc_progression": soc_progression,
                "message": "Trip within single charge. No charging stops required!"
            }

        # Route requires charging stops
        # Pool all available candidate stations (Direct stations prioritized, then low-penalty detours)
        all_candidates = []
        for c in direct_chargers:
            all_candidates.append({**c, "is_direct": True})
        for c in detour_chargers[:8]:
            all_candidates.append({**c, "is_direct": False})

        # Sort by distance along route from origin
        all_candidates.sort(key=lambda x: x["distance_from_origin_km"])

        current_km = 0.0
        current_soc = start_soc_percent
        max_reach_km = current_km + effective_range_km

        while max_reach_km < route_dist_km:
            # Find all reachable stations before running out of range
            reachable = [
                s for s in all_candidates
                if current_km < s["distance_from_origin_km"] <= max_reach_km
            ]

            if not reachable:
                # If no station reachable before reserve, pick the closest station just past reserve or nearest
                ahead = [s for s in all_candidates if s["distance_from_origin_km"] > current_km]
                if ahead:
                    best_station = ahead[0]
                else:
                    break
            else:
                # Select the best station that maximizes progress (preferring direct on-corridor)
                # Score = progress - detour_penalty_km * 1.5
                best_station = max(
                    reachable,
                    key=lambda s: s["distance_from_origin_km"] - (s.get("detour_penalty_km", 0.0) * 1.8)
                )

            # Calculate arrival SoC at this station
            leg_distance = best_station["distance_from_origin_km"] - current_km
            arrival_soc = max(0.0, round(current_soc - (leg_distance / usable_range_km * 100.0), 1))

            # Calculate charging session (charge back up to 85% - 90%)
            target_soc = 85.0
            kwh_needed = max(0.0, (target_soc - arrival_soc) / 100.0 * battery_kwh)
            station_power_kw = best_station.get("power_kw") or 3.3
            # Estimated charging minutes with 90% charger efficiency
            charge_duration_min = round((kwh_needed / (station_power_kw * 0.90)) * 60.0)
            charge_duration_min = max(15, charge_duration_min)  # minimum practical fast charge stop

            stop_info = {
                **best_station,
                "stop_sequence": len(recommended_stops) + 1,
                "arrival_soc_percent": arrival_soc,
                "target_soc_percent": target_soc,
                "energy_added_kwh": round(kwh_needed, 2),
                "est_charge_time_min": charge_duration_min
            }
            recommended_stops.append(stop_info)

            soc_progression.append({
                "location": best_station["name"],
                "distance_km": best_station["distance_from_origin_km"],
                "battery_percent": arrival_soc,
                "battery_after_charge": target_soc,
                "charge_time_min": charge_duration_min,
                "is_charge_stop": True
            })

            # Update simulation state
            current_km = best_station["distance_from_origin_km"]
            current_soc = target_soc
            max_reach_km = current_km + full_safe_leg_km

            # Prevent infinite loops in dense networks
            if len(recommended_stops) > 8:
                break

        # Arrival at destination
        remaining_leg = route_dist_km - current_km
        final_soc = max(0.0, round(current_soc - (remaining_leg / usable_range_km * 100.0), 1))
        soc_progression.append({
            "location": "Destination",
            "distance_km": route_dist_km,
            "battery_percent": final_soc,
            "is_charge_stop": False
        })

        return {
            "needs_charging": True,
            "ev_profile": profile,
            "usable_range_km": usable_range_km,
            "stops_count": len(recommended_stops),
            "recommended_stops": recommended_stops,
            "soc_progression": soc_progression,
            "total_charge_time_min": sum(s["est_charge_time_min"] for s in recommended_stops),
            "message": f"{len(recommended_stops)} fast charging stop(s) planned."
        }
