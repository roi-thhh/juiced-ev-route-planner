import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from src.router import RouteCorridorEngine, EV_PROFILES

def test_engine():
    engine = RouteCorridorEngine("data/bolt_type6_south_india.json")

    # Route: Kochi, Kerala (9.9312, 76.2673) to Coimbatore, Tamil Nadu (11.0168, 76.9558)
    kochi = (9.9312, 76.2673)
    coimbatore = (11.0168, 76.9558)

    print("=== 1. Testing Corridor Analysis (Kochi -> Coimbatore) ===")
    corridor = engine.analyze_corridor(kochi, coimbatore, corridor_width_km=3.0, detour_search_radius_km=15.0)

    route = corridor["route"]
    print(f"Direct Route Distance: {route['distance_km']} km")
    print(f"Direct Route Duration: {route['duration_min']} mins")
    print(f"Direct On-Corridor Chargers found: {len(corridor['direct_chargers'])}")
    print(f"Detour Chargers evaluated: {len(corridor['detour_chargers'])}")

    assert route["distance_km"] > 150, "Distance should be > 150 km"
    assert len(corridor["direct_chargers"]) > 0, "Should find direct chargers along Kochi-Coimbatore corridor"

    print("\nSample On-Corridor Charger:")
    dc = corridor["direct_chargers"][0]
    print(f"  Name: {dc['name']} (ID: {dc['id']}) at km {dc['distance_from_origin_km']} (dist to road: {dc['distance_to_route_km']} km)")

    if corridor["detour_chargers"]:
        print("\nSample Detour Charger:")
        dt = corridor["detour_chargers"][0]
        print(f"  Name: {dt['name']} (ID: {dt['id']})")
        print(f"  Detour penalty: +{dt['detour_penalty_km']} km, +{dt['detour_penalty_min']} mins")
        assert dt["detour_penalty_km"] >= 0, "Detour distance penalty must be >= 0"

    print("\n=== 2. Testing Charging Stop Optimization ===")
    for model_key in ["ather_450x", "ola_s1_pro", "ultraviolette_f77"]:
        plan = engine.plan_charging_stops(
            corridor,
            ev_profile_key=model_key,
            start_soc_percent=90.0,
            reserve_soc_percent=15.0
        )
        print(f"\nModel: {EV_PROFILES[model_key]['name']} (Range: {plan['usable_range_km']} km)")
        print(f"  Needs charging: {plan['needs_charging']}")
        print(f"  Stops count: {plan['stops_count']}")
        for s in plan["recommended_stops"]:
            print(f"    - Stop {s['stop_sequence']}: {s['name']} (Arrival SoC: {s['arrival_soc_percent']}%, +{s['est_charge_time_min']} min charge)")

    print("\nALL ROUTER TESTS PASSED!")

if __name__ == "__main__":
    test_engine()
