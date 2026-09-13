"""
Export Bolt.Earth Type-6 Chargers into Google Maps compatible formats:
1. KML (Keyhole Markup Language for Google My Maps / Google Earth)
2. CSV (Google My Maps structured CSV import)
3. Standalone Interactive HTML Map (Leaflet/OpenStreetMap preview)
"""

import json
import csv
import xml.etree.ElementTree as ET
from xml.dom import minidom
import os

def export_google_maps_formats():
    json_path = "data/bolt_type6_south_india.json"
    kml_path = "data/bolt_type6_chargers.kml"
    csv_path = "data/bolt_type6_chargers_google_maps.csv"
    html_path = "preview_map.html"

    with open(json_path, "r", encoding="utf-8") as f:
        stations = json.load(f)

    print(f"Loaded {len(stations)} stations from {json_path}")

    # ==========================================
    # 1. Generate CSV for Google My Maps
    # ==========================================
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "Title", "Latitude", "Longitude", "Power (kW)", "Connector Type",
            "State", "Address", "Charger ID", "Operator", "Google Maps Navigation Link"
        ])
        for s in stations:
            lat = s["latitude"]
            lng = s["longitude"]
            maps_url = f"https://www.google.com/maps/dir/?api=1&destination={lat},{lng}"
            writer.writerow([
                s["name"],
                lat,
                lng,
                f"{s['power_kw']} kW" if s["power_kw"] else "3.3 kW",
                s["connector_type"],
                s["state"],
                s["address"],
                s["id"],
                s["operator"],
                maps_url
            ])
    print(f"[OK] Exported CSV to {csv_path}")

    # ==========================================
    # 2. Generate KML for Google My Maps & Google Earth
    # ==========================================
    kml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<kml xmlns="http://www.opengis.net/kml/2.2">',
        '  <Document>',
        '    <name>Bolt.Earth EV Chargers - Type-6 DC Fast (Kerala &amp; Tamil Nadu)</name>',
        '    <description>Public Bolt.Earth Type-6 DC Fast Charging stations for 2-Wheeler EVs across Kerala and Tamil Nadu.</description>',
        '    <Style id="fastChargerIcon">',
        '      <IconStyle>',
        '        <scale>1.1</scale>',
        '        <Icon>',
        '          <href>https://maps.google.com/mapfiles/kml/shapes/gas_stations.png</href>',
        '        </Icon>',
        '      </IconStyle>',
        '    </Style>'
    ]

    for s in stations:
        lat = s["latitude"]
        lng = s["longitude"]
        name = s["name"].replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        address = s["address"].replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        cid = s["id"]
        power = f"{s['power_kw']} kW" if s["power_kw"] else "3.3 kW"
        state = s["state"]
        connector = s["connector_type"]
        maps_link = f"https://www.google.com/maps/dir/?api=1&amp;destination={lat},{lng}"

        description = (
            f"&lt;b&gt;Operator:&lt;/b&gt; Bolt.Earth&lt;br/&gt;"
            f"&lt;b&gt;Charger ID:&lt;/b&gt; {cid}&lt;br/&gt;"
            f"&lt;b&gt;Connector:&lt;/b&gt; {connector}&lt;br/&gt;"
            f"&lt;b&gt;Power Rating:&lt;/b&gt; {power}&lt;br/&gt;"
            f"&lt;b&gt;State:&lt;/b&gt; {state}&lt;br/&gt;"
            f"&lt;b&gt;Address:&lt;/b&gt; {address}&lt;br/&gt;"
            f"&lt;b&gt;Status:&lt;/b&gt; {s['status']}&lt;br/&gt;&lt;br/&gt;"
            f'&lt;a href="{maps_link}" target="_blank"&gt;Navigate in Google Maps&lt;/a&gt;'
        )

        kml_lines.append('    <Placemark>')
        kml_lines.append(f'      <name>{name}</name>')
        kml_lines.append(f'      <description>{description}</description>')
        kml_lines.append('      <styleUrl>#fastChargerIcon</styleUrl>')
        kml_lines.append('      <Point>')
        kml_lines.append(f'        <coordinates>{lng},{lat},0</coordinates>')
        kml_lines.append('      </Point>')
        kml_lines.append('    </Placemark>')

    kml_lines.append('  </Document>')
    kml_lines.append('</kml>')

    with open(kml_path, "w", encoding="utf-8") as f:
        f.write("\n".join(kml_lines))
    print(f"[OK] Exported KML to {kml_path}")

    # ==========================================
    # 3. Generate Standalone Interactive Web Map
    # ==========================================
    geojson_path = "data/bolt_type6_south_india.geojson"
    with open(geojson_path, "r", encoding="utf-8") as f:
        geojson_str = f.read()

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bolt.Earth Type-6 DC Fast Chargers - Kerala & Tamil Nadu</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body {{
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: #111;
      color: #eee;
    }}
    header {{
      background: #1e1e1e;
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #333;
    }}
    header h1 {{
      margin: 0;
      font-size: 1.1rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }}
    .badge {{
      background: #10b981;
      color: #000;
      font-size: 0.75rem;
      font-weight: bold;
      padding: 3px 8px;
      border-radius: 9999px;
    }}
    .stats {{
      font-size: 0.85rem;
      color: #aaa;
    }}
    #map {{
      flex: 1;
      width: 100%;
    }}
    .custom-popup {{
      font-size: 13px;
      line-height: 1.5;
    }}
    .custom-popup h4 {{
      margin: 0 0 6px 0;
      color: #059669;
      font-size: 14px;
    }}
    .custom-popup .nav-btn {{
      display: inline-block;
      margin-top: 8px;
      background: #2563eb;
      color: #fff;
      padding: 5px 10px;
      text-decoration: none;
      border-radius: 4px;
      font-weight: 500;
    }}
    .custom-popup .nav-btn:hover {{
      background: #1d4ed8;
    }}
  </style>
</head>
<body>
  <header>
    <h1>
      <span>⚡ Bolt.Earth EV Chargers</span>
      <span class="badge">Type-6 DC Fast</span>
    </h1>
    <div class="stats">
      <strong>{len(stations)} Stations</strong> (Kerala: 171 | Tamil Nadu: 12)
    </div>
  </header>
  <div id="map"></div>

  <script>
    const map = L.map('map').setView([10.5, 77.0], 7);

    L.tileLayer('https://{{s}}.basemaps.cartocdn.com/rastertiles/voyager/{{z}}/{{x}}/{{y}}{{r}}.png', {{
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 19
    }}).addTo(map);

    const geojsonData = {geojson_str};

    const markerIcon = L.divIcon({{
      className: 'custom-marker',
      html: '<div style="background:#10b981; border:2px solid #fff; width:14px; height:14px; border-radius:50%; box-shadow:0 0 6px rgba(0,0,0,0.5);"></div>',
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    }});

    L.geoJSON(geojsonData, {{
      pointToLayer: function(feature, latlng) {{
        return L.marker(latlng, {{ icon: markerIcon }});
      }},
      onEachFeature: function(feature, layer) {{
        const p = feature.properties;
        const lat = feature.geometry.coordinates[1];
        const lng = feature.geometry.coordinates[0];
        const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${{lat}},${{lng}}`;

        const content = `
          <div class="custom-popup">
            <h4>${{p.name}}</h4>
            <strong>Charger ID:</strong> ${{p.id}}<br/>
            <strong>Standard:</strong> ${{p.connector_type}}<br/>
            <strong>Power:</strong> ${{p.power_kw ? p.power_kw + ' kW' : '3.3 kW'}}<br/>
            <strong>State:</strong> ${{p.state}}<br/>
            <strong>Address:</strong> ${{p.address}}<br/>
            <a class="nav-btn" href="${{navUrl}}" target="_blank">Open in Google Maps</a>
          </div>
        `;
        layer.bindPopup(content);
      }}
    }}).addTo(map);
  </script>
</body>
</html>
"""
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"[OK] Exported interactive HTML map preview to {html_path}")

if __name__ == "__main__":
    export_google_maps_formats()
