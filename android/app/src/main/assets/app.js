/**
 * JUICED EV Route Planner - Dual Map Engine (Native Google Maps + Standard Leaflet)
 * Semi-Brutalist & Funky UI/UX Experience
 */

document.addEventListener("DOMContentLoaded", () => {
  // Application State
  let currentOriginCoords = [9.9312, 76.2673]; // Kochi default
  let currentDestCoords = [11.0168, 76.9558];   // Coimbatore default
  let selectedEvModel = "ather_450x";
  let evProfiles = {};
  let allStations = [];
  let activePowerFilter = null;
  let lastRouteData = null;

  // Map Engine State
  let activeEngine = "leaflet"; // "leaflet" or "google"
  let googleMapsLoaded = false;
  let googleApiKey = "";
  let isProductionMode = false;

  // Leaflet Map & Layer References
  let leafletMap = null;
  let layerNetwork = null;
  let layerCorridor = null;
  let layerRoute = null;
  let layerDirect = null;
  let layerDetours = null;
  let layerStops = null;
  let layerDetourLines = null;

  // Native Google Maps References
  let gMap = null;
  let gLayers = {
    corridorPolygon: null,
    routePolyline: null,
    routeGlowPolyline: null,
    directMarkers: [],
    detourMarkers: [],
    detourPolylines: [],
    stopMarkers: [],
    networkMarkers: [],
    endpointMarkers: [],
    infoWindow: null
  };
  let gAutocompleteOrigin = null;
  let gAutocompleteDest = null;

  // DOM Elements
  const originInput = document.getElementById("originInput");
  const destInput = document.getElementById("destInput");
  const originDropdown = document.getElementById("originDropdown");
  const destDropdown = document.getElementById("destDropdown");
  const btnSwap = document.getElementById("btnSwapPoints");
  const btnCurrentLocation = document.getElementById("btnCurrentLocation");
  const evModelsGrid = document.getElementById("evModelsGrid");
  const customEvPanel = document.getElementById("customEvPanel");
  const customRangeInput = document.getElementById("customRangeInput");
  
  const sliderStartSoc = document.getElementById("sliderStartSoc");
  const valStartSoc = document.getElementById("valStartSoc");
  const sliderReserveSoc = document.getElementById("sliderReserveSoc");
  const valReserveSoc = document.getElementById("valReserveSoc");
  const sliderCorridorWidth = document.getElementById("sliderCorridorWidth");
  const valCorridorWidth = document.getElementById("valCorridorWidth");

  const btnPlanRoute = document.getElementById("btnPlanRoute");
  const planSpinner = document.getElementById("planSpinner");
  const resultsContainer = document.getElementById("resultsContainer");
  const tripSummaryCard = document.getElementById("tripSummaryCard");
  const stopsList = document.getElementById("stopsList");
  const detoursList = document.getElementById("detoursList");
  const btnOpenGoogleMaps = document.getElementById("btnOpenGoogleMaps");
  const networkStatsBadge = document.getElementById("networkStatsBadge");

  // Bottom Sheet Elements
  const bottomSheet = document.getElementById("bottomSheet");
  const sheetHandleZone = document.getElementById("sheetHandleZone");

  // Engine Switcher & Modal Elements
  const mapEngineBadge = document.getElementById("mapEngineBadge");
  const engineDot = document.getElementById("engineDot");
  const engineStatusText = document.getElementById("engineStatusText");
  const btnOpenKeyModal = document.getElementById("btnOpenKeyModal");
  const btnToggleEngine = document.getElementById("btnToggleEngine");
  const keyModalBackdrop = document.getElementById("keyModalBackdrop");
  const btnCloseKeyModal = document.getElementById("btnCloseKeyModal");
  const btnCancelKeyModal = document.getElementById("btnCancelKeyModal");
  const btnSaveGoogleKey = document.getElementById("btnSaveGoogleKey");
  const inputGoogleApiKey = document.getElementById("inputGoogleApiKey");
  const btnToggleKeyVisibility = document.getElementById("btnToggleKeyVisibility");
  const chkSaveToEnv = document.getElementById("chkSaveToEnv");

  // Splash & Launch Screen Controller
  const splashScreen = document.getElementById("splashScreen");
  const splashProgressBar = document.getElementById("splashProgressBar");
  const splashStatusTicker = document.getElementById("splashStatusTicker");
  const splashPercentText = document.getElementById("splashPercentText");
  const splashSkipBtn = document.getElementById("splashSkipBtn");

  let splashProgress = 0;
  let splashTargetProgress = 15;
  let splashDismissed = false;

  function updateSplashDisplay(progress, statusText) {
    if (splashDismissed || !splashScreen) return;
    splashProgress = Math.max(splashProgress, Math.min(progress, 100));
    if (splashProgressBar) splashProgressBar.style.width = `${splashProgress}%`;
    if (splashPercentText) splashPercentText.textContent = `${Math.round(splashProgress)}%`;
    if (statusText && splashStatusTicker) splashStatusTicker.textContent = statusText;
  }

  function dismissSplash() {
    if (splashDismissed || !splashScreen) return;
    splashDismissed = true;
    updateSplashDisplay(100, "GRID READY // ALL SYSTEMS JUICED");
    setTimeout(() => {
      splashScreen.classList.add("splash-dismissed");
      setTimeout(() => {
        splashScreen.style.display = "none";
      }, 700);
    }, 280);
  }

  if (splashSkipBtn) {
    splashSkipBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      dismissSplash();
    });
  }
  if (splashScreen) {
    splashScreen.addEventListener("click", () => {
      dismissSplash();
    });
  }

  // Smooth progression loop for the loading animation
  function startSplashSequence() {
    let current = 0;
    const tickerSteps = [
      { at: 10, msg: "INITIALIZING GEO-ENGINE..." },
      { at: 35, msg: "POLLING BOLT.EARTH CHARGERS..." },
      { at: 65, msg: "CALIBRATING BATTERY SOC MATRICES..." },
      { at: 85, msg: "WARMING DUAL ROUTE ENGINES..." },
      { at: 100, msg: "GRID READY // ALL SYSTEMS JUICED" }
    ];

    const interval = setInterval(() => {
      if (splashDismissed) {
        clearInterval(interval);
        return;
      }
      if (current < splashTargetProgress) {
        current += 2;
        if (current > splashTargetProgress) current = splashTargetProgress;
        
        const matched = tickerSteps.filter(s => current >= s.at).pop();
        updateSplashDisplay(current, matched ? matched.msg : null);

        if (current >= 100) {
          clearInterval(interval);
          setTimeout(dismissSplash, 400);
        }
      }
    }, 25);
  }

  // ====================================================
  // 1. App Boot & Engine Configuration
  // ====================================================
  async function boot() {
    startSplashSequence();
    splashTargetProgress = 30;

    initLeafletMap();

    splashTargetProgress = 50;
    await loadInitialData();
    splashTargetProgress = 75;

    // Check server & local configuration for Google Maps API Key
    try {
      const cfgResp = await fetch("/api/config");
      if (cfgResp.ok) {
        const cfg = await cfgResp.json();
        isProductionMode = cfg.is_production;
        if (isProductionMode && btnOpenKeyModal) {
          btnOpenKeyModal.style.display = "none";
        }
        if (cfg.google_maps_api_key) {
          googleApiKey = cfg.google_maps_api_key;
        }
      }
    } catch (e) {
      console.warn("Config check error:", e);
    }

    // Check localStorage fallback
    if (!googleApiKey) {
      googleApiKey = localStorage.getItem("JUICED_GOOGLE_MAPS_KEY") || localStorage.getItem("VOLTPATH_GOOGLE_MAPS_KEY") || "";
    }

    if (googleApiKey) {
      loadGoogleMapsScript(googleApiKey);
    } else {
      setEngineStatus("leaflet");
    }

    // Initial default demo route
    originInput.value = "Kochi";
    destInput.value = "Coimbatore";
    triggerRoutePlanning(true);

    // Release splash screen to completion
    splashTargetProgress = 100;
  }

  function setEngineStatus(engine) {
    activeEngine = engine;
    if (engine === "google") {
      if (mapEngineBadge) mapEngineBadge.className = "brutal-btn-pill engine-badge";
      if (engineDot) {
        engineDot.className = "engine-dot";
        engineDot.style.background = "#00FF9D";
      }
      if (engineStatusText) engineStatusText.textContent = "GOOGLE MAPS";
      if (btnToggleEngine) btnToggleEngine.innerHTML = `<span>🔄 Switch to OSM</span>`;
    } else {
      if (mapEngineBadge) mapEngineBadge.className = "brutal-btn-pill engine-badge";
      if (engineDot) {
        engineDot.className = "engine-dot";
        engineDot.style.background = "#FFE600";
      }
      if (engineStatusText) engineStatusText.textContent = "OSM MAP";
      if (btnToggleEngine) btnToggleEngine.innerHTML = `<span>🔄 Switch to Google Maps</span>`;
    }
  }

  // ====================================================
  // 2. Leaflet Map Engine
  // ====================================================
  function initLeafletMap() {
    leafletMap = L.map("map", {
      zoomControl: false
    }).setView([10.5, 77.0], 7);

    L.control.zoom({ position: "topright" }).addTo(leafletMap);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
      maxZoom: 19
    }).addTo(leafletMap);

    layerNetwork = L.layerGroup().addTo(leafletMap);
    layerCorridor = L.layerGroup().addTo(leafletMap);
    layerRoute = L.layerGroup().addTo(leafletMap);
    layerDetourLines = L.layerGroup().addTo(leafletMap);
    layerDirect = L.layerGroup().addTo(leafletMap);
    layerDetours = L.layerGroup().addTo(leafletMap);
    layerStops = L.layerGroup().addTo(leafletMap);
  }

  function renderLeafletNetwork(stations) {
    layerNetwork.clearLayers();
    const dotIcon = L.divIcon({
      className: "net-dot",
      html: '<div style="background:#475569; width:6px; height:6px; border-radius:50%; opacity:0.6;"></div>',
      iconSize: [6, 6],
      iconAnchor: [3, 3]
    });

    stations.forEach(s => {
      const marker = L.marker([s.latitude, s.longitude], { icon: dotIcon });
      marker.bindPopup(createPopupHtml(s, "NETWORK"));
      layerNetwork.addLayer(marker);
    });
  }

  // Global Google Maps Authentication / Billing Failure Handler
  window.gm_authFailure = () => {
    console.warn("Google Maps authentication or billing notice detected. Automatically switching to standard map engine.");
    setEngineStatus("leaflet");
    initLeafletMap();
    renderLeafletNetwork(allStations);
    if (lastRouteData) renderLeafletRouteResults(lastRouteData);
    
    // Show polite notification banner
    const notice = document.createElement("div");
    notice.style.cssText = "position:fixed;bottom:20px;right:20px;background:#1e293b;border:1px solid #f59e0b;color:#fef08a;padding:12px 18px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.5);z-index:9999;font-size:13px;max-width:380px;line-height:1.4;";
    notice.innerHTML = "<strong>Google Maps Notice:</strong> Your Google Cloud key requires billing to be enabled at <a href='https://console.cloud.google.com/billing' target='_blank' style='color:#38bdf8;text-decoration:underline;'>Google Cloud Billing</a>. Running on the Standard Engine seamlessly in the meantime.";
    document.body.appendChild(notice);
    setTimeout(() => notice.remove(), 12000);
  };

  // ====================================================
  // 3. Native Google Maps Engine
  // ====================================================
  function loadGoogleMapsScript(apiKey) {
    if (window.google && window.google.maps) {
      initGoogleMap();
      return;
    }

    const existingScript = document.getElementById("googleMapsScript");
    if (existingScript) existingScript.remove();

    const script = document.createElement("script");
    script.id = "googleMapsScript";
    // Load Maps and Geometry libraries
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=geometry&callback=onGoogleMapsReady`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      console.warn("Google Maps script failed to load. Using standard map engine.");
      setEngineStatus("leaflet");
    };
    window.onGoogleMapsReady = () => {
      googleMapsLoaded = true;
      initGoogleMap();
    };
    document.head.appendChild(script);
  }

  function initGoogleMap() {
    const mapDiv = document.getElementById("map");

    // Clean up Leaflet DOM if switching
    if (leafletMap) {
      leafletMap.remove();
      leafletMap = null;
    }

    // Google Maps Dark/Night Highway Styling
    const darkMapStyle = [
      { elementType: "geometry", stylers: [{ color: "#171c26" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#171c26" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },
      {
        featureType: "road",
        elementType: "geometry",
        stylers: [{ color: "#2d3748" }]
      },
      {
        featureType: "road.highway",
        elementType: "geometry",
        stylers: [{ color: "#3b4a6b" }]
      },
      {
        featureType: "road.highway",
        elementType: "geometry.stroke",
        stylers: [{ color: "#1f293d" }]
      },
      {
        featureType: "transit",
        elementType: "geometry",
        stylers: [{ color: "#1e293b" }]
      },
      {
        featureType: "water",
        elementType: "geometry",
        stylers: [{ color: "#0c1322" }]
      }
    ];

    gMap = new google.maps.Map(mapDiv, {
      center: { lat: 10.5, lng: 77.0 },
      zoom: 7,
      styles: darkMapStyle,
      mapTypeControl: true,
      mapTypeControlOptions: {
        style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
        position: google.maps.ControlPosition.TOP_LEFT
      },
      fullscreenControl: false,
      streetViewControl: false
    });

    gLayers.infoWindow = new google.maps.InfoWindow();

    // Render stations on Google Map
    renderGoogleNetwork(allStations);

    setEngineStatus("google");

    // If route was previously computed, re-render natively on Google Maps
    if (lastRouteData) {
      renderGoogleRouteResults(lastRouteData);
    }
  }

  function clearGoogleLayers() {
    if (gLayers.corridorPolygon) gLayers.corridorPolygon.setMap(null);
    if (gLayers.routePolyline) gLayers.routePolyline.setMap(null);
    if (gLayers.routeGlowPolyline) gLayers.routeGlowPolyline.setMap(null);

    gLayers.directMarkers.forEach(m => m.setMap(null));
    gLayers.detourMarkers.forEach(m => m.setMap(null));
    gLayers.stopMarkers.forEach(m => m.setMap(null));
    gLayers.endpointMarkers.forEach(m => m.setMap(null));
    gLayers.detourPolylines.forEach(p => p.setMap(null));

    gLayers.directMarkers = [];
    gLayers.detourMarkers = [];
    gLayers.stopMarkers = [];
    gLayers.endpointMarkers = [];
    gLayers.detourPolylines = [];
  }

  function renderGoogleNetwork(stations) {
    gLayers.networkMarkers.forEach(m => m.setMap(null));
    gLayers.networkMarkers = [];

    const dotSvg = {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 3,
      fillColor: "#64748b",
      fillOpacity: 0.6,
      strokeWeight: 0
    };

    stations.forEach(s => {
      const marker = new google.maps.Marker({
        position: { lat: s.latitude, lng: s.longitude },
        map: gMap,
        icon: dotSvg,
        title: s.name
      });
      marker.addListener("click", () => {
        gLayers.infoWindow.setContent(createPopupHtml(s, "NETWORK"));
        gLayers.infoWindow.open(gMap, marker);
      });
      gLayers.networkMarkers.push(marker);
    });
  }

  function renderGoogleRouteResults(data) {
    clearGoogleLayers();

    const bounds = new google.maps.LatLngBounds();
    const routeCoords = data.route_geometry.coordinates.map(c => {
      const pt = new google.maps.LatLng(c[1], c[0]);
      bounds.extend(pt);
      return pt;
    });

    // 1. Corridor Polygon
    if (data.corridor_polygon && data.corridor_polygon.coordinates && data.corridor_polygon.coordinates[0]) {
      const polyCoords = data.corridor_polygon.coordinates[0].map(c => ({ lat: c[1], lng: c[0] }));
      gLayers.corridorPolygon = new google.maps.Polygon({
        paths: polyCoords,
        strokeColor: "#FFE600",
        strokeOpacity: 0.6,
        strokeWeight: 1.5,
        fillColor: "#FFE600",
        fillOpacity: 0.08,
        map: gMap
      });
    }

    // 2. Route Path (Glow + Line)
    gLayers.routeGlowPolyline = new google.maps.Polyline({
      path: routeCoords,
      strokeColor: "#06b6d4",
      strokeOpacity: 0.35,
      strokeWeight: 8,
      map: gMap
    });

    gLayers.routePolyline = new google.maps.Polyline({
      path: routeCoords,
      strokeColor: "#10b981",
      strokeOpacity: 0.95,
      strokeWeight: 4,
      map: gMap
    });

    gMap.fitBounds(bounds, 50);

    // 3. Origin & Destination Markers
    const originMarker = new google.maps.Marker({
      position: { lat: data.trip_summary.origin[0], lng: data.trip_summary.origin[1] },
      map: gMap,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 7,
        fillColor: "#06b6d4",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2
      },
      title: "Origin"
    });
    gLayers.endpointMarkers.push(originMarker);

    const destMarker = new google.maps.Marker({
      position: { lat: data.trip_summary.destination[0], lng: data.trip_summary.destination[1] },
      map: gMap,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 7,
        fillColor: "#ef4444",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2
      },
      title: "Destination"
    });
    gLayers.endpointMarkers.push(destMarker);

    // 4. Direct On-Corridor Markers
    const directIcon = {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 6,
      fillColor: "#10b981",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2
    };

    data.direct_chargers.forEach(s => {
      const m = new google.maps.Marker({
        position: { lat: s.latitude, lng: s.longitude },
        map: gMap,
        icon: directIcon,
        title: s.name
      });
      m.addListener("click", () => {
        gLayers.infoWindow.setContent(createPopupHtml(s, "DIRECT_ON_CORRIDOR"));
        gLayers.infoWindow.open(gMap, m);
      });
      gLayers.directMarkers.push(m);
    });

    // 5. Detour Markers & Connector Lines
    const detourIcon = {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 6,
      fillColor: "#f59e0b",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2
    };

    data.detour_chargers.forEach(s => {
      const m = new google.maps.Marker({
        position: { lat: s.latitude, lng: s.longitude },
        map: gMap,
        icon: detourIcon,
        title: s.name
      });
      m.addListener("click", () => {
        gLayers.infoWindow.setContent(createPopupHtml(s, "DETOUR_REQUIRED", s.detour_penalty_km, s.detour_penalty_min));
        gLayers.infoWindow.open(gMap, m);
      });
      gLayers.detourMarkers.push(m);

      if (s.branch_point) {
        const line = new google.maps.Polyline({
          path: [
            { lat: s.branch_point[0], lng: s.branch_point[1] },
            { lat: s.latitude, lng: s.longitude }
          ],
          strokeColor: "#f59e0b",
          strokeOpacity: 0.8,
          strokeWeight: 2,
          map: gMap
        });
        gLayers.detourPolylines.push(line);
      }
    });

    // 6. Recommended Stops (Gold Pulse Star)
    data.charging_plan.recommended_stops.forEach(s => {
      const stopMarker = new google.maps.Marker({
        position: { lat: s.latitude, lng: s.longitude },
        map: gMap,
        label: {
          text: `⚡${s.stop_sequence}`,
          color: "#000",
          fontSize: "11px",
          fontWeight: "bold"
        },
        icon: {
          path: "M 0,-15 L 4,-5 L 14,-3 L 7,4 L 9,14 L 0,9 L -9,14 L -7,4 L -14,-3 L -4,-5 Z",
          scale: 1.2,
          fillColor: "#fbbf24",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2
        },
        zIndex: 9999
      });
      stopMarker.addListener("click", () => {
        gLayers.infoWindow.setContent(createPopupHtml(s, "RECOMMENDED_STOP"));
        gLayers.infoWindow.open(gMap, stopMarker);
      });
      gLayers.stopMarkers.push(stopMarker);
    });
  }

  // ====================================================
  // 4. Initial Data Load (Chargers & EV Profiles)
  // ====================================================
  const EMBEDDED_EV_PROFILES = {
    "ather_450x": { name: "Ather 450X", battery_kwh: 3.7, usable_range_km: 105, max_charge_rate_kw: 3.3, efficiency_wh_km: 35.0 },
    "ather_apex": { name: "Ather 450 Apex", battery_kwh: 3.7, usable_range_km: 100, max_charge_rate_kw: 3.3, efficiency_wh_km: 37.0 },
    "ola_s1_pro": { name: "Ola S1 Pro Gen 2", battery_kwh: 4.0, usable_range_km: 140, max_charge_rate_kw: 3.3, efficiency_wh_km: 28.5 },
    "simple_one": { name: "Simple One", battery_kwh: 5.0, usable_range_km: 190, max_charge_rate_kw: 3.3, efficiency_wh_km: 26.3 },
    "ultraviolette_f77": { name: "Ultraviolette F77 Mach 2", battery_kwh: 10.3, usable_range_km: 230, max_charge_rate_kw: 6.6, efficiency_wh_km: 44.8 }
  };

  async function loadInitialData() {
    try {
      const profileResp = await fetch("/api/ev-profiles");
      if (profileResp.ok) {
        evProfiles = await profileResp.json();
      } else {
        evProfiles = EMBEDDED_EV_PROFILES;
      }
    } catch (e) {
      console.warn("Using embedded EV profiles fallback:", e);
      evProfiles = EMBEDDED_EV_PROFILES;
    }
    renderEvProfiles();

    try {
      let chargerData = null;
      if (window.JUICED_EMBEDDED_CHARGERS && window.JUICED_EMBEDDED_CHARGERS.chargers) {
        chargerData = window.JUICED_EMBEDDED_CHARGERS;
      }
      try {
        const chargerResp = await fetch("/api/chargers");
        if (chargerResp.ok) {
          chargerData = await chargerResp.json();
        }
      } catch (err) {
        console.log("Server chargers endpoint unreachable, trying local assets:", err);
      }

      if (!chargerData) {
        // Fallback to bundled chargers.json for standalone Android APK
        try {
          const localResp = await fetch("./chargers.json");
          if (localResp.ok) {
            chargerData = await localResp.json();
          }
        } catch (fetchErr) {
          console.log("Local fetch chargers.json notice:", fetchErr);
        }
      }

      if (chargerData && chargerData.chargers) {
        allStations = chargerData.chargers;
        networkStatsBadge.innerHTML = `<span>⚡ ${allStations.length} Stations Loaded</span>`;
        if (leafletMap) renderLeafletNetwork(allStations);
      }
    } catch (e) {
      console.warn("Data loading notice:", e);
    }
  }

  function renderEvProfiles() {
    evModelsGrid.innerHTML = "";
    for (const [key, p] of Object.entries(evProfiles)) {
      const card = document.createElement("div");
      card.className = `ev-card ${key === selectedEvModel ? "active" : ""}`;
      card.dataset.model = key;
      card.innerHTML = `
        <div class="ev-card-name">${p.name}</div>
        <div class="ev-card-specs">${p.usable_range_km} km range &bull; ${p.battery_kwh} kWh</div>
      `;
      card.addEventListener("click", () => selectEvModel(key));
      evModelsGrid.appendChild(card);
    }

    const customCard = document.createElement("div");
    customCard.className = `ev-card ${selectedEvModel === "custom" ? "active" : ""}`;
    customCard.dataset.model = "custom";
    customCard.innerHTML = `
      <div class="ev-card-name">Custom EV</div>
      <div class="ev-card-specs">User Defined Range</div>
    `;
    customCard.addEventListener("click", () => selectEvModel("custom"));
    evModelsGrid.appendChild(customCard);
  }

  function selectEvModel(key) {
    selectedEvModel = key;
    document.querySelectorAll(".ev-card").forEach(c => {
      c.classList.toggle("active", c.dataset.model === key);
    });
    customEvPanel.style.display = key === "custom" ? "block" : "none";
  }

  function createPopupHtml(station, category, penaltyKm = 0, penaltyMin = 0) {
    const power = station.power_kw ? `${station.power_kw} kW` : "3.3 kW";
    const gmapsNav = `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`;
    
    let badgeHtml = "";
    if (category === "DIRECT_ON_CORRIDOR") {
      badgeHtml = `<span class="popup-badge direct" style="background:rgba(0,240,255,0.15); color:#00F0FF; border:1px solid #00F0FF;">⚡ Direct on Route</span>`;
    } else if (category === "DETOUR_REQUIRED") {
      badgeHtml = `<span class="popup-badge detour" style="background:rgba(189,0,255,0.2); color:#F2E4FA; border:1px solid #BD00FF;">↪️ Detour (+${penaltyKm} km, +${penaltyMin} min)</span>`;
    } else if (category === "RECOMMENDED_STOP") {
      badgeHtml = `<span class="popup-badge direct" style="background:#CCFF00; color:#131318; font-weight:800;">⚡ Recommended Stop</span>`;
    }

    return `
      <div class="charger-popup-card">
        ${badgeHtml}
        <h4>${station.name}</h4>
        <p><strong>Charger ID:</strong> ${station.id}</p>
        <p><strong>Standard:</strong> ${station.connector_type}</p>
        <p><strong>Fast Charging Rate:</strong> ${power}</p>
        <p><strong>Address:</strong> ${station.address}</p>
        <p><strong>State:</strong> ${station.state}</p>
        <a href="${gmapsNav}" target="_blank" class="popup-nav-link">Navigate in Google Maps</a>
      </div>
    `;
  }

  // ====================================================
  // 5. Autocomplete & Geocoding (Fallback & Presets)
  // ====================================================
  function setupAutocomplete(inputEl, dropdownEl, onSelect) {
    let debounceTimer = null;
    inputEl.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      const query = inputEl.value.trim();
      if (query.length < 2) {
        dropdownEl.classList.remove("active");
        return;
      }
      debounceTimer = setTimeout(async () => {
        try {
          const resp = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
          if (resp.ok) {
            const data = await resp.json();
            renderDropdown(dropdownEl, data.results, (place) => {
              inputEl.value = place.label;
              dropdownEl.classList.remove("active");
              onSelect(place.latitude, place.longitude, place.label);
            });
          }
        } catch (e) {
          console.error("Geocode fetch error:", e);
        }
      }, 250);
    });

    document.addEventListener("click", (e) => {
      if (!inputEl.contains(e.target) && !dropdownEl.contains(e.target)) {
        dropdownEl.classList.remove("active");
      }
    });
  }

  function renderDropdown(dropdownEl, places, onPick) {
    dropdownEl.innerHTML = "";
    if (!places || places.length === 0) {
      dropdownEl.classList.remove("active");
      return;
    }
    places.forEach(p => {
      const li = document.createElement("li");
      li.textContent = p.label;
      li.addEventListener("click", () => onPick(p));
      dropdownEl.appendChild(li);
    });
    dropdownEl.classList.add("active");
  }

  setupAutocomplete(originInput, originDropdown, (lat, lng) => {
    currentOriginCoords = [lat, lng];
  });

  setupAutocomplete(destInput, destDropdown, (lat, lng) => {
    currentDestCoords = [lat, lng];
  });

  // Swap Points
  btnSwap.addEventListener("click", () => {
    const tempText = originInput.value;
    originInput.value = destInput.value;
    destInput.value = tempText;

    const tempCoords = currentOriginCoords;
    currentOriginCoords = currentDestCoords;
    currentDestCoords = tempCoords;
  });

  // Current Location
  btnCurrentLocation.addEventListener("click", () => {
    if ("geolocation" in navigator) {
      btnCurrentLocation.textContent = "⌛";
      navigator.geolocation.getCurrentPosition(
        pos => {
          btnCurrentLocation.textContent = "🎯";
          currentOriginCoords = [pos.coords.latitude, pos.coords.longitude];
          originInput.value = `My Location (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`;
        },
        () => {
          btnCurrentLocation.textContent = "🎯";
          alert("Could not access GPS location. Please enter a city manually.");
        }
      );
    }
  });

  // Quick Preset Chips
  document.querySelectorAll(".route-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const oParts = chip.dataset.o.split(",").map(Number);
      const dParts = chip.dataset.d.split(",").map(Number);
      currentOriginCoords = [oParts[0], oParts[1]];
      currentDestCoords = [dParts[0], dParts[1]];
      originInput.value = chip.dataset.ol;
      destInput.value = chip.dataset.dl;
      triggerRoutePlanning();
    });
  });

  // Sliders
  sliderStartSoc.addEventListener("input", () => {
    valStartSoc.textContent = `${sliderStartSoc.value}%`;
  });
  sliderReserveSoc.addEventListener("input", () => {
    valReserveSoc.textContent = `${sliderReserveSoc.value}%`;
  });
  sliderCorridorWidth.addEventListener("input", () => {
    valCorridorWidth.textContent = `${sliderCorridorWidth.value} km`;
  });

  // Filter Chips
  document.querySelectorAll(".filter-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      activePowerFilter = chip.dataset.power ? parseFloat(chip.dataset.power) : null;
    });
  });

  // ====================================================
  // 6. Calculate Route & Corridor Engine
  // ====================================================
  btnPlanRoute.addEventListener("click", () => triggerRoutePlanning(false));

  async function triggerRoutePlanning(isSilent = false) {
    if (!currentOriginCoords || !currentDestCoords) {
      if (!isSilent) alert("Please select both an Origin and Destination.");
      return;
    }

    planSpinner.style.display = "inline-block";
    btnPlanRoute.disabled = true;

    const payload = {
      origin: currentOriginCoords,
      destination: currentDestCoords,
      ev_model: selectedEvModel,
      custom_range_km: selectedEvModel === "custom" ? parseFloat(customRangeInput.value) : null,
      start_soc: parseFloat(sliderStartSoc.value),
      reserve_soc: parseFloat(sliderReserveSoc.value),
      corridor_width_km: parseFloat(sliderCorridorWidth.value),
      detour_search_radius_km: 12.0,
      power_filter_kw: activePowerFilter
    };

    try {
      let result = null;
      try {
        const resp = await fetch("/api/route/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (resp.ok) {
          result = await resp.json();
        }
      } catch (netErr) {
        console.log("Server route plan unavailable, running on-device engine:", netErr);
      }

      if (!result) {
        // Run self-contained client-side corridor calculation (for standalone APK)
        result = await computeClientRoutePlan(payload);
      }

      lastRouteData = result;
      renderRouteResults(result);
    } catch (e) {
      console.warn("Route planning notice:", e);
      if (!isSilent) {
        alert(`Error planning route: ${e.message}`);
      }
    } finally {
      planSpinner.style.display = "none";
      btnPlanRoute.disabled = false;
    }
  }

  // ====================================================
  // Standalone Client-Side Route & Corridor Engine
  // ====================================================
  function distKmBetween(lat1, lon1, lat2, lon2) {
    const R = 6371.0;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function minDistanceToPolylineKm(stationLat, stationLng, coords) {
    let minDist = Infinity;
    const pX = stationLng * 109.6;
    const pY = stationLat * 110.6;

    for (let i = 0; i < coords.length - 1; i++) {
      const aX = coords[i][0] * 109.6;
      const aY = coords[i][1] * 110.6;
      const bX = coords[i + 1][0] * 109.6;
      const bY = coords[i + 1][1] * 110.6;

      const dx = bX - aX;
      const dy = bY - aY;
      const lenSq = dx * dx + dy * dy;

      let d = 0;
      if (lenSq === 0) {
        d = Math.hypot(pX - aX, pY - aY);
      } else {
        const t = Math.max(0, Math.min(1, ((pX - aX) * dx + (pY - aY) * dy) / lenSq));
        const projX = aX + t * dx;
        const projY = aY + t * dy;
        d = Math.hypot(pX - projX, pY - projY);
      }
      if (d < minDist) minDist = d;
    }
    return minDist;
  }

  function buildCorridorPolygon(coords, widthKm) {
    if (!coords || coords.length < 2) return null;
    const offsetDeg = (widthKm || 3.0) / 111.0;
    const leftPts = [];
    const rightPts = [];

    const step = Math.max(1, Math.floor(coords.length / 120));
    const sampled = [];
    for (let i = 0; i < coords.length; i += step) {
      sampled.push(coords[i]);
    }
    if (sampled[sampled.length - 1] !== coords[coords.length - 1]) {
      sampled.push(coords[coords.length - 1]);
    }

    for (let i = 0; i < sampled.length; i++) {
      const p = sampled[i];
      let nx = 0, ny = 0;
      if (i < sampled.length - 1) {
        const pNext = sampled[i + 1];
        const dx = pNext[0] - p[0];
        const dy = pNext[1] - p[1];
        const len = Math.hypot(dx, dy) || 1e-6;
        nx = -dy / len;
        ny = dx / len;
      } else {
        const pPrev = sampled[i - 1];
        const dx = p[0] - pPrev[0];
        const dy = p[1] - pPrev[1];
        const len = Math.hypot(dx, dy) || 1e-6;
        nx = -dy / len;
        ny = dx / len;
      }

      leftPts.push([p[0] + nx * offsetDeg, p[1] + ny * offsetDeg]);
      rightPts.push([p[0] - nx * offsetDeg, p[1] - ny * offsetDeg]);
    }

    const ring = [...leftPts, ...rightPts.reverse(), leftPts[0]];
    return {
      type: "Polygon",
      coordinates: [ring]
    };
  }

  async function computeClientRoutePlan(payload) {
    const origin = payload.origin;
    const dest = payload.destination;
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${dest[1]},${dest[0]}?overview=full&geometries=geojson&steps=true`;

    const osrmResp = await fetch(osrmUrl);
    if (!osrmResp.ok) throw new Error("Could not reach OSRM routing service.");
    const osrmData = await osrmResp.json();
    if (!osrmData.routes || osrmData.routes.length === 0) throw new Error("No route found between points.");

    const route = osrmData.routes[0];
    const totalDistKm = route.distance / 1000.0;
    const totalDurationMin = route.duration / 60.0;
    const coords = route.geometry.coordinates; // [[lng, lat], ...]

    const corridorWidth = payload.corridor_width_km || 3.0;
    const detourRadius = payload.detour_search_radius_km || 12.0;

    let eligibleStations = allStations;
    if (payload.power_filter_kw) {
      eligibleStations = eligibleStations.filter(s => (s.power_kw || 3.3) >= payload.power_filter_kw);
    }

    const direct = [];
    const detours = [];

    eligibleStations.forEach(s => {
      const dist = minDistanceToPolylineKm(s.latitude, s.longitude, coords);
      if (dist <= corridorWidth) {
        direct.push({
          ...s,
          distance_to_route_km: Math.round(dist * 100) / 100,
          distance_from_route_km: Math.round(dist * 100) / 100,
          detour_penalty_km: 0.0,
          detour_penalty_min: 0.0,
          category: "DIRECT_ON_CORRIDOR"
        });
      } else if (dist <= detourRadius) {
        const detourDist = Math.round(dist * 2.2 * 10) / 10;
        const detourMin = Math.round((detourDist / 35.0) * 60);
        detours.push({
          ...s,
          distance_to_route_km: Math.round(dist * 100) / 100,
          distance_from_route_km: Math.round(dist * 100) / 100,
          detour_penalty_km: detourDist,
          detour_penalty_min: detourMin,
          category: "DETOUR_REQUIRED"
        });
      }
    });

    const profile = evProfiles[payload.ev_model] || {
      name: "Custom EV",
      battery_kwh: 4.0,
      usable_range_km: payload.custom_range_km || 120,
      max_charge_rate_kw: 3.3
    };

    const startSoc = payload.start_soc || 90.0;
    const reserveSoc = payload.reserve_soc || 15.0;
    const rangeKm = profile.usable_range_km;

    const recommendedStops = [];
    let currentSoc = startSoc;
    let distanceCovered = 0;

    const candidateStations = [...direct, ...detours];
    candidateStations.sort((a, b) => {
      const dA = distKmBetween(origin[0], origin[1], a.latitude, a.longitude);
      const dB = distKmBetween(origin[0], origin[1], b.latitude, b.longitude);
      return dA - dB;
    });

    let currentRangeAvailable = (currentSoc / 100.0) * rangeKm;

    if (currentRangeAvailable - (reserveSoc / 100.0) * rangeKm < totalDistKm) {
      let currentPos = origin;

      for (let i = 0; i < candidateStations.length; i++) {
        const s = candidateStations[i];
        const distFromPrev = distKmBetween(currentPos[0], currentPos[1], s.latitude, s.longitude);
        const distFromDest = distKmBetween(s.latitude, s.longitude, dest[0], dest[1]);

        if (distFromPrev > currentRangeAvailable - (reserveSoc / 100.0) * rangeKm * 0.85) {
          const arrivalSoc = Math.max(reserveSoc, Math.round(currentSoc - (distFromPrev / rangeKm) * 100));
          const targetSoc = 85.0;
          const kwhNeeded = ((targetSoc - arrivalSoc) / 100.0) * profile.battery_kwh;
          const chargeRate = Math.min(s.power_kw || 3.3, profile.max_charge_rate_kw || 3.3);
          const chargeTimeMin = Math.round((kwhNeeded / chargeRate) * 60);

          recommendedStops.push({
            ...s,
            stop_sequence: recommendedStops.length + 1,
            name: s.name || `Bolt.Earth Station ${s.id || ''}`,
            id: s.id || `BE-${recommendedStops.length + 1}`,
            latitude: s.latitude,
            longitude: s.longitude,
            power_kw: s.power_kw || 3.3,
            arrival_soc_percent: arrivalSoc,
            target_soc_percent: targetSoc,
            energy_added_kwh: Math.round(kwhNeeded * 10) / 10,
            est_charge_time_min: chargeTimeMin,
            distance_from_origin_km: Math.round((distanceCovered + distFromPrev) * 10) / 10
          });

          currentPos = [s.latitude, s.longitude];
          distanceCovered += distFromPrev;
          currentSoc = targetSoc;
          currentRangeAvailable = (currentSoc / 100.0) * rangeKm;

          if (distFromDest <= currentRangeAvailable - (reserveSoc / 100.0) * rangeKm) {
            break;
          }
        }
      }
    }

    const corridorPolygon = buildCorridorPolygon(coords, corridorWidth);
    const gmapsWaypoints = recommendedStops.map(s => `${s.latitude},${s.longitude}`).join("%7C");
    let gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin[0]},${origin[1]}&destination=${dest[0]},${dest[1]}`;
    if (gmapsWaypoints) {
      gmapsUrl += `&waypoints=${gmapsWaypoints}`;
    }

    const totalChargeTimeMin = recommendedStops.reduce((sum, s) => sum + (s.est_charge_time_min || 0), 0);

    return {
      success: true,
      trip_summary: {
        origin: origin,
        destination: dest,
        direct_distance_km: Math.round(totalDistKm * 10) / 10,
        direct_duration_min: Math.round(totalDurationMin),
        ev_profile: profile.name,
        usable_range_km: profile.usable_range_km,
        charging_stops_count: recommendedStops.length,
        total_charge_time_min: totalChargeTimeMin,
        direct_chargers_count: direct.length,
        detour_chargers_count: detours.length,
        google_maps_nav_url: gmapsUrl
      },
      route_geometry: {
        type: "LineString",
        coordinates: coords
      },
      corridor_polygon: corridorPolygon,
      corridor_width_km: corridorWidth,
      direct_chargers: direct,
      detour_chargers: detours,
      charging_plan: {
        needs_charging: recommendedStops.length > 0,
        ev_profile: profile,
        usable_range_km: profile.usable_range_km,
        stops_count: recommendedStops.length,
        recommended_stops: recommendedStops,
        total_charge_time_min: totalChargeTimeMin,
        message: `${recommendedStops.length} fast charging stop(s) planned.`
      }
    };
  }

  // ====================================================
  // 7. Render Route Results (Dispatches to Active Engine)
  // ====================================================
  function renderRouteResults(data) {
    resultsContainer.style.display = "block";

    if (bottomSheet) {
      bottomSheet.classList.remove("collapsed");
      bottomSheet.classList.add("expanded");
    }

    if (activeEngine === "google" && gMap) {
      renderGoogleRouteResults(data);
    } else {
      renderLeafletRouteResults(data);
    }

    updateSidebarCards(data);
  }

  function renderLeafletRouteResults(data) {
    layerCorridor.clearLayers();
    layerRoute.clearLayers();
    layerDetourLines.clearLayers();
    layerDirect.clearLayers();
    layerDetours.clearLayers();
    layerStops.clearLayers();

    const trip = data.trip_summary || {};
    const plan = data.charging_plan || { recommended_stops: [] };
    const routeGeom = data.route_geometry;
    const corridorPolygon = data.corridor_polygon;

    // Corridor Polygon (Semi-Brutalist Dashed Yellow)
    if (corridorPolygon && corridorPolygon.coordinates && corridorPolygon.coordinates.length > 0) {
      try {
        const corridorLayer = L.geoJSON(corridorPolygon, {
          style: {
            color: "#FFE600",
            weight: 2,
            opacity: 0.8,
            fillColor: "#FFE600",
            fillOpacity: 0.08,
            dashArray: "5 5"
          }
        });
        layerCorridor.addLayer(corridorLayer);
      } catch (err) {
        console.warn("Corridor layer warning:", err);
      }
    }

    // Chunky Cased Route (Black Outer Casing + Neon Mint Core)
    if (routeGeom && routeGeom.coordinates && routeGeom.coordinates.length > 0) {
      const casingLine = L.polyline(routeGeom.coordinates.map(c => [c[1], c[0]]), {
        color: "#000000",
        weight: 8,
        opacity: 1
      });
      layerRoute.addLayer(casingLine);

      const mainLine = L.polyline(routeGeom.coordinates.map(c => [c[1], c[0]]), {
        color: "#00FF9D",
        weight: 4.5,
        opacity: 1
      });
      layerRoute.addLayer(mainLine);

      leafletMap.fitBounds(mainLine.getBounds(), { padding: [40, 40] });
    }

    // Endpoint Pins (Brutalist Square Sticker Pins)
    const originMarker = L.marker(trip.origin, {
      icon: L.divIcon({
        className: "endpoint-icon",
        html: '<div style="background:#2E5BFF; border:2.5px solid #000; width:22px; height:22px; border-radius:6px; box-shadow:2.5px 2.5px 0px #000; color:#fff; display:flex; align-items:center; justify-content:center; font-family:var(--font-mono); font-size:12px; font-weight:800;">A</div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      })
    }).bindPopup(`<strong>ORIGIN:</strong> ${originInput.value || "Start"}`);
    layerRoute.addLayer(originMarker);

    const destMarker = L.marker(trip.destination, {
      icon: L.divIcon({
        className: "endpoint-icon",
        html: '<div style="background:#FF3366; border:2.5px solid #000; width:22px; height:22px; border-radius:6px; box-shadow:2.5px 2.5px 0px #000; color:#fff; display:flex; align-items:center; justify-content:center; font-family:var(--font-mono); font-size:12px; font-weight:800;">B</div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      })
    }).bindPopup(`<strong>DESTINATION:</strong> ${destInput.value || "Finish"}`);
    layerRoute.addLayer(destMarker);

    // Direct On-Corridor Stations (Chunky Mint Stickers)
    const directIcon = L.divIcon({
      className: "direct-station-icon",
      html: '<div style="background:#00FF9D; border:2px solid #000; width:16px; height:16px; border-radius:50%; box-shadow:2px 2px 0px #000;"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    (data.direct_chargers || []).forEach(s => {
      const m = L.marker([s.latitude, s.longitude], { icon: directIcon });
      m.bindPopup(createPopupHtml(s, "DIRECT_ON_CORRIDOR"));
      layerDirect.addLayer(m);
    });

    // Viable Detour Stations (Chunky Pink Stickers)
    const detourIcon = L.divIcon({
      className: "detour-station-icon",
      html: '<div style="background:#FF3366; border:2px solid #000; width:16px; height:16px; border-radius:4px; box-shadow:2px 2px 0px #000;"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    (data.detour_chargers || []).forEach(s => {
      const m = L.marker([s.latitude, s.longitude], { icon: detourIcon });
      m.bindPopup(createPopupHtml(s, "DETOUR_REQUIRED", s.detour_penalty_km, s.detour_penalty_min));
      layerDetours.addLayer(m);

      if (s.branch_point) {
        const detourLine = L.polyline([[s.branch_point[0], s.branch_point[1]], [s.latitude, s.longitude]], {
          color: "#FF3366",
          weight: 2.5,
          opacity: 0.9,
          dashArray: "4, 4"
        });
        layerDetourLines.addLayer(detourLine);
      }
    });

    // Recommended Charging Stops (Pulsing Star Sticker)
    ((plan && plan.recommended_stops) || []).forEach(s => {
      const pulseHtml = `
        <div class="pulse-marker-wrapper">
          <div class="pulse-ring"></div>
          <div class="pulse-marker-core">⚡</div>
        </div>
      `;
      const stopIcon = L.divIcon({
        className: "pulse-marker",
        html: pulseHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const m = L.marker([s.latitude, s.longitude], { icon: stopIcon, zIndexOffset: 1000 });
      m.bindPopup(createPopupHtml(s, "RECOMMENDED_STOP"));
      layerStops.addLayer(m);
    });
  }

  function updateSidebarCards(data) {
    const trip = data.trip_summary || {};
    const plan = data.charging_plan || { recommended_stops: [] };

    const hours = Math.floor((trip.direct_duration_min || 0) / 60);
    const mins = Math.round((trip.direct_duration_min || 0) % 60);
    const timeFormatted = hours > 0 ? `${hours}H ${mins}M` : `${mins}M`;

    tripSummaryCard.innerHTML = `
      <div class="card-header-bar">
        <span class="card-title-icon">🎫</span>
        <h2 class="card-title-text">FLIGHT PLAN // ITINERARY</h2>
        <span class="card-sticker yellow">VALIDATED</span>
      </div>
      <div class="trip-metric-grid">
        <div class="metric-box">
          <div class="metric-val">${trip.direct_distance_km || 0} <span style="font-size:0.75rem; font-family:var(--font-mono);">KM</span></div>
          <div class="metric-label">ROUTE DISTANCE</div>
        </div>
        <div class="metric-box">
          <div class="metric-val">${timeFormatted}</div>
          <div class="metric-label">RIDE DURATION</div>
        </div>
        <div class="metric-box">
          <div class="metric-val" style="color:${(trip.charging_stops_count || 0) > 0 ? '#FFE600' : '#00FF9D'};">
            ${trip.charging_stops_count || 0}
          </div>
          <div class="metric-label">CHARGING STOPS</div>
        </div>
      </div>
      <div style="margin-top: 10px; font-size: 0.74rem; font-family: var(--font-mono); font-weight: 700; color: #FFE600; background: #0C0D10; border: 2px solid #000; box-shadow: 2px 2px 0px #000; padding: 8px 12px; border-radius: 8px;">
        <span>⚡ CORRIDOR COVERAGE: ${trip.direct_chargers_count || 0} DIRECT // ${trip.detour_chargers_count || 0} DETOURS</span>
      </div>
    `;

    // Stops List
    const recStops = plan.recommended_stops || [];
    if (recStops.length === 0) {
      stopsList.innerHTML = `
        <div style="padding: 10px; font-size: 0.8rem; color: #34d399; text-align: center;">
          ✅ Single Charge Trip! Your ${trip.ev_profile || "EV"} can reach the destination without recharging.
        </div>
      `;
    } else {
      stopsList.innerHTML = "";
      recStops.forEach(s => {
        const item = document.createElement("div");
        item.className = "stop-item";
        item.innerHTML = `
          <div class="stop-badge-seq">STAGE 0${s.stop_sequence}</div>
          <div class="stop-title">${s.name}</div>
          <div class="stop-details">
            <strong>CORRIDOR POS:</strong> KM ${s.distance_from_origin_km} along highway<br/>
            <strong>ARRIVAL BATTERY:</strong> <span style="color:${s.arrival_soc_percent < 20 ? '#FF3366' : '#00FF9D'}; font-weight:800;">${s.arrival_soc_percent}% SoC</span><br/>
            <strong>TOP-UP TIME:</strong> ~${s.est_charge_time_min} mins to reach ${s.target_soc_percent}%<br/>
            <strong>HARDWARE:</strong> Bolt.Earth Type-6 (${s.power_kw || 3.3} kW) &bull; ${s.id}
          </div>
        `;
        item.addEventListener("click", () => {
          if (activeEngine === "google" && gMap) {
            gMap.setCenter({ lat: s.latitude, lng: s.longitude });
            gMap.setZoom(15);
          } else if (leafletMap) {
            leafletMap.setView([s.latitude, s.longitude], 15);
          }
        });
        stopsList.appendChild(item);
      });
    }

    // Detours List
    detoursList.innerHTML = "";
    if (data.detour_chargers.length === 0) {
      detoursList.innerHTML = `<div style="font-size:0.75rem; font-family:var(--font-mono); color:#9ca3af;">No additional detours within range.</div>`;
    } else {
      data.detour_chargers.slice(0, 5).forEach(s => {
        const item = document.createElement("div");
        item.className = "detour-item";
        item.innerHTML = `
          <div>
            <div class="detour-name" title="${s.name}">${s.name}</div>
            <div style="font-size:0.7rem; font-family:var(--font-mono); color:#8E91A0;">⚡ ${s.power_kw || 3.3} kW &bull; ${s.distance_to_route_km} km off corridor</div>
          </div>
          <div class="detour-pill-badge">+${s.detour_penalty_km} km / +${Math.round(s.detour_penalty_min)}m</div>
        `;
        item.addEventListener("click", () => {
          if (activeEngine === "google" && gMap) {
            gMap.setCenter({ lat: s.latitude, lng: s.longitude });
            gMap.setZoom(14);
          } else if (leafletMap) {
            leafletMap.setView([s.latitude, s.longitude], 14);
          }
        });
        detoursList.appendChild(item);
      });
    }

    btnOpenGoogleMaps.href = trip.google_maps_nav_url;
  }

  // ====================================================
  // 8. Modal & Engine Switcher Interactions
  // ====================================================
  if (btnOpenKeyModal) {
    btnOpenKeyModal.addEventListener("click", () => {
      inputGoogleApiKey.value = googleApiKey;
      keyModalBackdrop.style.display = "flex";
    });
  }

  btnCloseKeyModal.addEventListener("click", () => {
    keyModalBackdrop.style.display = "none";
  });

  btnCancelKeyModal.addEventListener("click", () => {
    keyModalBackdrop.style.display = "none";
  });

  btnToggleKeyVisibility.addEventListener("click", () => {
    inputGoogleApiKey.type = inputGoogleApiKey.type === "password" ? "text" : "password";
  });

  btnSaveGoogleKey.addEventListener("click", async () => {
    const key = inputGoogleApiKey.value.trim();
    if (!key || key.length < 15) {
      alert("Please enter a valid Google Cloud API Key (starts with AIzaSy...)");
      return;
    }

    googleApiKey = key;
    localStorage.setItem("JUICED_GOOGLE_MAPS_KEY", key);
    localStorage.setItem("VOLTPATH_GOOGLE_MAPS_KEY", key);

    // Save to server .env if checked
    if (chkSaveToEnv.checked) {
      try {
        await fetch("/api/config/key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: key })
        });
      } catch (e) {
        console.warn("Could not write key to server .env:", e);
      }
    }

    keyModalBackdrop.style.display = "none";
    loadGoogleMapsScript(key);
  });

  // Bottom Sheet Tap/Drag Handle Zone Toggle
  if (sheetHandleZone && bottomSheet) {
    sheetHandleZone.addEventListener("click", () => {
      if (bottomSheet.classList.contains("collapsed")) {
        bottomSheet.classList.remove("collapsed");
      } else if (!bottomSheet.classList.contains("expanded")) {
        bottomSheet.classList.add("expanded");
      } else {
        bottomSheet.classList.remove("expanded");
        bottomSheet.classList.add("collapsed");
      }
      setTimeout(() => {
        if (leafletMap) leafletMap.invalidateSize();
        if (gMap && window.google) google.maps.event.trigger(gMap, "resize");
      }, 360);
    });
  }

  // Engine Badge Click Toggle
  if (mapEngineBadge) {
    mapEngineBadge.addEventListener("click", () => {
      if (activeEngine === "google") {
        // Toggle back to Leaflet
        activeEngine = "leaflet";
        setEngineStatus("leaflet");
        initLeafletMap();
        renderLeafletNetwork(allStations);
        if (lastRouteData) renderLeafletRouteResults(lastRouteData);
      } else {
        // Switch to Google Maps or prompt for key
        if (googleApiKey) {
          loadGoogleMapsScript(googleApiKey);
        } else {
          keyModalBackdrop.style.display = "flex";
        }
      }
    });
  }

  btnToggleEngine.addEventListener("click", () => {
    if (activeEngine === "google") {
      // Switch back to Leaflet
      activeEngine = "leaflet";
      setEngineStatus("leaflet");
      initLeafletMap();
      renderLeafletNetwork(allStations);
      if (lastRouteData) renderLeafletRouteResults(lastRouteData);
    } else {
      if (googleApiKey) {
        loadGoogleMapsScript(googleApiKey);
      } else {
        keyModalBackdrop.style.display = "flex";
      }
    }
  });

  // Start Application
  boot();
});
