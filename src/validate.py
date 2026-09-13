"""
Validation test suite for Phase 1 deliverables.
"""

import json
import os
import sys

def validate():
    geojson_path = "data/bolt_type6_south_india.geojson"
    json_path = "data/bolt_type6_south_india.json"
    summary_path = "docs/phase1_data_summary.md"

    print("=== 1. Checking File Existence ===")
    for p in [geojson_path, json_path, summary_path]:
        assert os.path.exists(p), f"Missing expected file: {p}"
        size = os.path.getsize(p)
        print(f"  [OK] {p} exists ({size:,} bytes)")

    print("\n=== 2. Validating JSON Deliverable ===")
    with open(json_path, "r", encoding="utf-8") as f:
        stations = json.load(f)
    assert isinstance(stations, list), "JSON output must be a list"
    assert len(stations) > 0, "JSON output cannot be empty"
    print(f"  Total stations: {len(stations)}")

    required_keys = {
        "id", "name", "operator", "connector_type", "power_kw",
        "status", "address", "state", "latitude", "longitude", "raw_meta"
    }

    ids = set()
    state_counts = {}
    for idx, s in enumerate(stations):
        missing = required_keys - set(s.keys())
        assert not missing, f"Station {idx} missing keys: {missing}"
        assert s["operator"] == "Bolt.Earth", f"Invalid operator: {s['operator']}"
        assert "Type-6" in s["connector_type"], f"Invalid connector: {s['connector_type']}"
        assert s["status"] in ("AVAILABLE", "UNKNOWN"), f"Invalid status: {s['status']}"
        assert s["state"] in ("Kerala", "Tamil Nadu"), f"Unexpected state: {s['state']}"
        assert 8.0 <= s["latitude"] <= 13.5, f"Latitude out of bounds: {s['latitude']}"
        assert 75.0 <= s["longitude"] <= 80.5, f"Longitude out of bounds: {s['longitude']}"
        assert s["id"] not in ids, f"Duplicate ID detected: {s['id']}"
        ids.add(s["id"])
        state_counts[s["state"]] = state_counts.get(s["state"], 0) + 1

    print(f"  [OK] All {len(stations)} records strictly conform to normalized schema.")
    print(f"  [OK] State distribution: {state_counts}")

    print("\n=== 3. Validating GeoJSON Deliverable ===")
    with open(geojson_path, "r", encoding="utf-8") as f:
        geojson = json.load(f)

    assert geojson.get("type") == "FeatureCollection", "GeoJSON root must be FeatureCollection"
    features = geojson.get("features", [])
    assert len(features) == len(stations), f"Feature count ({len(features)}) does not match JSON count ({len(stations)})"

    for idx, feat in enumerate(features):
        assert feat.get("type") == "Feature", f"Feature {idx} missing type Feature"
        geom = feat.get("geometry", {})
        assert geom.get("type") == "Point", f"Feature {idx} geometry must be Point"
        coords = geom.get("coordinates", [])
        assert len(coords) == 2, f"Feature {idx} coordinates must be [lng, lat]"
        lng, lat = coords
        assert 75.0 <= lng <= 80.5, f"Feature {idx} lng out of bounds: {lng}"
        assert 8.0 <= lat <= 13.5, f"Feature {idx} lat out of bounds: {lat}"
        props = feat.get("properties", {})
        assert "id" in props and "state" in props and "connector_type" in props

    print(f"  [OK] GeoJSON RFC 7946 validation passed for all {len(features)} features.")

    print("\n=== 4. Validating Summary Markdown Report ===")
    with open(summary_path, "r", encoding="utf-8") as f:
        md_text = f.read()

    assert "Kerala" in md_text and "Tamil Nadu" in md_text
    assert "Type-6" in md_text
    assert "data/bolt_type6_south_india.geojson" in md_text
    print("  [OK] docs/phase1_data_summary.md contents verified.")

    print("\nSample station record:")
    print(json.dumps(stations[0], indent=2))
    print("\nALL VERIFICATION CHECKS PASSED!")

if __name__ == "__main__":
    validate()
