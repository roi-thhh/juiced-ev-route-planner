"""
Data Parsing and Normalization module for Bolt.Earth Type-6 DC Fast Chargers.
"""

import json
import re
from typing import Dict, Any, Optional, List, Tuple
from shapely.geometry import shape, Point

# Load state boundaries
BOUNDARIES_FILE = "data/boundaries_south_india.json"

class StateClassifier:
    def __init__(self, boundaries_file: str = BOUNDARIES_FILE):
        self.polygons = []
        try:
            with open(boundaries_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                for feat in data.get("features", []):
                    st_name = feat.get("properties", {}).get("NAME_1", "")
                    geom = shape(feat.get("geometry"))
                    self.polygons.append((st_name, geom))
        except Exception as e:
            print(f"[Warning] Could not load boundary polygons from {boundaries_file}: {e}")

    def classify(self, lat: float, lng: float, address: str = "") -> str:
        pt = Point(lng, lat)
        
        # 1. Exact point-in-polygon check
        for st_name, geom in self.polygons:
            if geom.contains(pt):
                return st_name
                
        # 2. Check if very close to boundary (distance < 0.02 deg ~ 2km for coastal / border stations)
        closest_state = None
        min_dist = float("inf")
        for st_name, geom in self.polygons:
            dist = geom.distance(pt)
            if dist < min_dist and dist < 0.05:  # Within ~5km of border/coastline
                min_dist = dist
                closest_state = st_name
        if closest_state:
            return closest_state

        # 3. Address heuristic fallback
        addr_lower = (address or "").lower()
        if "kerala" in addr_lower:
            return "Kerala"
        elif "tamil nadu" in addr_lower or "tamilnadu" in addr_lower:
            return "Tamil Nadu"
        elif "karnataka" in addr_lower or "bangalore" in addr_lower or "bengaluru" in addr_lower or "mysore" in addr_lower:
            return "Karnataka"
        elif "puducherry" in addr_lower or "pondicherry" in addr_lower:
            return "Puducherry"

        # 4. Pincode heuristic fallback
        pincodes = re.findall(r"\b([567]\d{5})\b", address)
        if pincodes:
            pin = int(pincodes[0])
            if 670000 <= pin <= 699999:
                return "Kerala"
            elif 600000 <= pin <= 649999:
                return "Tamil Nadu"
            elif 560000 <= pin <= 599999:
                return "Karnataka"

        return "Unknown"


def is_type6_charger(record: Dict[str, Any]) -> bool:
    """
    Checks if a record corresponds to a Type-6 DC Fast Charger.
    """
    model_info = record.get("model", {})
    model_id = (model_info.get("modelId") or "").upper()
    
    # Check for Type 6 in modelId or model attributes
    if "TYPE6" in model_id or "TYPE-6" in model_id:
        return True
    if "2WFC" in model_id and "TYPE7" not in model_id:
        return True
    return False


def parse_power_kw(model_id: str) -> Optional[float]:
    """
    Extracts power rating in kW from model identifier.
    e.g. OCPP_2WFC_1_3KW_TYPE6_SIM -> 3.3 kW
         OCPP_2WFC_1_6KW_TYPE6_SIM -> 6.6 kW
         OCPP_2WFC_1_10KW_TYPE6_SIM -> 10.0 kW
    """
    model_id = (model_id or "").upper()
    if "1_3KW" in model_id or "3.3KW" in model_id or "3_3KW" in model_id:
        return 3.3
    elif "1_6KW" in model_id or "6.6KW" in model_id or "6KW" in model_id or "6_6KW" in model_id:
        return 6.6
    elif "1_10KW" in model_id or "10KW" in model_id or "10_0KW" in model_id:
        return 10.0
    elif "15KW" in model_id:
        return 15.0
    elif "30KW" in model_id:
        return 30.0
        
    match = re.search(r"(\d+(?:[_\.]\d+)?)KW", model_id)
    if match:
        val_str = match.group(1).replace("_", ".")
        try:
            return float(val_str)
        except ValueError:
            pass
    return None


def extract_station_name(record: Dict[str, Any], charger_id: str, address: str) -> str:
    """
    Derives an informative, human-readable station name.
    """
    station_obj = record.get("station", {})
    if station_obj.get("name"):
        return station_obj.get("name").strip()
        
    generic_names = {"kerala", "tamil nadu", "tamilnadu", "india", "null", "karnataka"}
    
    if address:
        cleaned = address.strip()
        # Look for landmark / building / store prefixes
        cleaned = re.sub(r"^(?:null\s*|,\s*)", "", cleaned, flags=re.I)
        parts = [p.strip() for p in cleaned.split(",") if p.strip()]
        for part in parts:
            part_clean = re.sub(r"^\d{6}\s*", "", part).strip()
            if len(part_clean) > 3 and part_clean.lower() not in generic_names and not re.match(r"^\d+$", part_clean):
                return part_clean

    # Fallback to pincode / landmark if present in address
    pincodes = re.findall(r"\b([567]\d{5})\b", address)
    if pincodes:
        return f"Bolt.Earth Station ({pincodes[0]}) - {charger_id}"

    return f"Bolt.Earth Station {charger_id}"


def normalize_record(record: Dict[str, Any], classifier: StateClassifier) -> Optional[Dict[str, Any]]:
    """
    Normalizes a raw Bolt.Earth API charger record into the target schema.
    """
    # Skip cluster features
    if record.get("properties", {}).get("cluster"):
        return None

    charger_id = record.get("chargerId") or str(record.get("_id"))
    geometry = record.get("geometry", {})
    coordinates = geometry.get("coordinates", [])
    if len(coordinates) < 2:
        return None

    lng = float(coordinates[0])
    lat = float(coordinates[1])
    
    station_meta = record.get("station", {})
    raw_address = station_meta.get("address", "") or ""
    
    # Clean up common string issues like "null600117"
    cleaned_address = raw_address.replace("null", " ").strip()
    
    state = classifier.classify(lat, lng, cleaned_address)
    name = extract_station_name(record, charger_id, cleaned_address)
    
    model_obj = record.get("model", {})
    model_id = model_obj.get("modelId", "")
    power_kw = parse_power_kw(model_id)

    # Determine connector label
    if "TYPE6" in model_id and "TYPE7" in model_id:
        connector_desc = "Type-6 DC Fast / Type-7 AC Dual"
    else:
        connector_desc = "Type-6 DC Fast"

    return {
        "id": charger_id,
        "name": name,
        "operator": "Bolt.Earth",
        "connector_type": connector_desc,
        "power_kw": power_kw,
        "status": "AVAILABLE",
        "address": cleaned_address,
        "state": state,
        "latitude": round(lat, 6),
        "longitude": round(lng, 6),
        "raw_meta": record
    }


def to_geojson_feature(normalized: Dict[str, Any]) -> Dict[str, Any]:
    """
    Converts a normalized charger dictionary to a standard GeoJSON Feature.
    """
    properties = {k: v for k, v in normalized.items() if k not in ("latitude", "longitude", "raw_meta")}
    # Include power rating and connector in top-level GeoJSON properties
    return {
        "type": "Feature",
        "id": normalized["id"],
        "geometry": {
            "type": "Point",
            "coordinates": [normalized["longitude"], normalized["latitude"]]
        },
        "properties": properties
    }
