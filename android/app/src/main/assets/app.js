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
    // Load Maps, Geometry, and Places libraries
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=geometry,places&callback=onGoogleMapsReady`;
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
      let rawList = [];
      if (window.JUICED_EMBEDDED_CHARGERS) {
        rawList = Array.isArray(window.JUICED_EMBEDDED_CHARGERS)
          ? window.JUICED_EMBEDDED_CHARGERS
          : (window.JUICED_EMBEDDED_CHARGERS.chargers || []);
      }
      try {
        const chargerResp = await fetch("/api/chargers");
        if (chargerResp.ok) {
          const cData = await chargerResp.json();
          rawList = Array.isArray(cData) ? cData : (cData.chargers || rawList);
        }
      } catch (err) {
        // standalone / offline mode
      }

      if (!rawList || rawList.length === 0) {
        // Fallback to bundled chargers.json for standalone Android APK
        try {
          const localResp = await fetch("./chargers.json");
          if (localResp.ok) {
            const cData = await localResp.json();
            rawList = Array.isArray(cData) ? cData : (cData.chargers || []);
          }
        } catch (fetchErr) {
          console.log("Local fetch chargers.json notice:", fetchErr);
        }
      }

      if (rawList && rawList.length > 0) {
        allStations = rawList;
        networkStatsBadge.innerHTML = `<span class="pulse-status-dot"></span> ${allStations.length} STATIONS`;
        if (leafletMap) renderLeafletNetwork(allStations);
        if (gMap) renderGoogleNetwork(allStations);
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
  // 5. Comprehensive South India Offline Database & Geocoding
  // ====================================================
  const SOUTH_INDIA_PRESET_PLACES = [
    { label: "Kochi, Kerala", name: "Kochi", state: "Kerala", latitude: 9.9312, longitude: 76.2673 },
    { label: "Ernakulam, Kerala", name: "Ernakulam", state: "Kerala", latitude: 9.9816, longitude: 76.2999 },
    { label: "Coimbatore, Tamil Nadu", name: "Coimbatore", state: "Tamil Nadu", latitude: 11.0168, longitude: 76.9558 },
    { label: "Kozhikode (Calicut), Kerala", name: "Kozhikode", state: "Kerala", latitude: 11.2588, longitude: 75.7804 },
    { label: "Thrissur, Kerala", name: "Thrissur", state: "Kerala", latitude: 10.5276, longitude: 76.2144 },
    { label: "Thiruvananthapuram (Trivandrum), Kerala", name: "Thiruvananthapuram", state: "Kerala", latitude: 8.5241, longitude: 76.9366 },
    { label: "Munnar, Idukki, Kerala", name: "Munnar", state: "Kerala", latitude: 10.0889, longitude: 77.0595 },
    { label: "Palakkad, Kerala", name: "Palakkad", state: "Kerala", latitude: 10.7867, longitude: 76.6548 },
    { label: "Wayanad (Kalpetta), Kerala", name: "Wayanad", state: "Kerala", latitude: 11.6103, longitude: 76.0828 },
    { label: "Kannur, Kerala", name: "Kannur", state: "Kerala", latitude: 11.8745, longitude: 75.3704 },
    { label: "Kasaragod, Kerala", name: "Kasaragod", state: "Kerala", latitude: 12.5102, longitude: 74.9852 },
    { label: "Kollam, Kerala", name: "Kollam", state: "Kerala", latitude: 8.8932, longitude: 76.6141 },
    { label: "Alappuzha (Alleppey), Kerala", name: "Alappuzha", state: "Kerala", latitude: 9.4981, longitude: 76.3388 },
    { label: "Kottayam, Kerala", name: "Kottayam", state: "Kerala", latitude: 9.5916, longitude: 76.5222 },
    { label: "Malappuram, Kerala", name: "Malappuram", state: "Kerala", latitude: 11.0732, longitude: 76.0740 },
    { label: "Idukki (Painavu), Kerala", name: "Idukki", state: "Kerala", latitude: 9.8494, longitude: 76.9806 },
    { label: "Pathanamthitta, Kerala", name: "Pathanamthitta", state: "Kerala", latitude: 9.2648, longitude: 76.7870 },
    { label: "Ooty (Udhagamandalam), Tamil Nadu", name: "Ooty", state: "Tamil Nadu", latitude: 11.4102, longitude: 76.6950 },
    { label: "Kodaikanal, Tamil Nadu", name: "Kodaikanal", state: "Tamil Nadu", latitude: 10.2381, longitude: 77.4892 },
    { label: "Madurai, Tamil Nadu", name: "Madurai", state: "Tamil Nadu", latitude: 9.9252, longitude: 78.1198 },
    { label: "Salem, Tamil Nadu", name: "Salem", state: "Tamil Nadu", latitude: 11.6643, longitude: 78.1460 },
    { label: "Chennai, Tamil Nadu", name: "Chennai", state: "Tamil Nadu", latitude: 13.0827, longitude: 80.2707 },
    { label: "Bengaluru, Karnataka", name: "Bengaluru", state: "Karnataka", latitude: 12.9716, longitude: 77.5946 },
    { label: "Mysuru (Mysore), Karnataka", name: "Mysuru", state: "Karnataka", latitude: 12.2958, longitude: 76.6394 },
    { label: "Mangaluru (Mangalore), Karnataka", name: "Mangaluru", state: "Karnataka", latitude: 12.9141, longitude: 74.8560 },
    { label: "Pollachi, Tamil Nadu", name: "Pollachi", state: "Tamil Nadu", latitude: 10.6586, longitude: 77.0094 },
    { label: "Tiruppur, Tamil Nadu", name: "Tiruppur", state: "Tamil Nadu", latitude: 11.1085, longitude: 77.3411 },
    { label: "Erode, Tamil Nadu", name: "Erode", state: "Tamil Nadu", latitude: 11.3410, longitude: 77.7172 },
    { label: "Dindigul, Tamil Nadu", name: "Dindigul", state: "Tamil Nadu", latitude: 10.3673, longitude: 77.9803 },
    { label: "Tirunelveli, Tamil Nadu", name: "Tirunelveli", state: "Tamil Nadu", latitude: 8.7139, longitude: 77.7567 },
    { label: "Kanyakumari, Tamil Nadu", name: "Kanyakumari", state: "Tamil Nadu", latitude: 8.0883, longitude: 77.5385 },
    { label: "Vagamon, Kerala", name: "Vagamon", state: "Kerala", latitude: 9.6865, longitude: 76.9056 },
    { label: "Thekkady (Kumily), Kerala", name: "Thekkady", state: "Kerala", latitude: 9.6031, longitude: 77.1681 },
    { label: "Guruvayur, Kerala", name: "Guruvayur", state: "Kerala", latitude: 10.5947, longitude: 76.0379 },
    { label: "Varkala, Kerala", name: "Varkala", state: "Kerala", latitude: 8.7379, longitude: 76.7163 },
    { label: "Kovalam, Kerala", name: "Kovalam", state: "Kerala", latitude: 8.4004, longitude: 76.9787 },
    { label: "Sulthan Bathery, Kerala", name: "Sulthan Bathery", state: "Kerala", latitude: 11.6634, longitude: 76.2570 },
    { label: "Mananthavady, Kerala", name: "Mananthavady", state: "Kerala", latitude: 11.8029, longitude: 76.0033 },
    { label: "Nilambur, Kerala", name: "Nilambur", state: "Kerala", latitude: 11.2776, longitude: 76.2263 },
    { label: "Perinthalmanna, Kerala", name: "Perinthalmanna", state: "Kerala", latitude: 10.9760, longitude: 76.2255 },
    { label: "Tirur, Kerala", name: "Tirur", state: "Kerala", latitude: 10.9148, longitude: 75.9228 },
    { label: "Ponnani, Kerala", name: "Ponnani", state: "Kerala", latitude: 10.7742, longitude: 75.9251 },
    { label: "Shoranur, Kerala", name: "Shoranur", state: "Kerala", latitude: 10.7634, longitude: 76.2785 },
    { label: "Ottapalam, Kerala", name: "Ottapalam", state: "Kerala", latitude: 10.7717, longitude: 76.3789 },
    { label: "Chalakudy, Kerala", name: "Chalakudy", state: "Kerala", latitude: 10.3070, longitude: 76.3335 },
    { label: "Kodungallur, Kerala", name: "Kodungallur", state: "Kerala", latitude: 10.2289, longitude: 76.2046 },
    { label: "Angamaly, Kerala", name: "Angamaly", state: "Kerala", latitude: 10.1960, longitude: 76.3860 },
    { label: "Aluva, Kerala", name: "Aluva", state: "Kerala", latitude: 10.1076, longitude: 76.3516 },
    { label: "Perumbavoor, Kerala", name: "Perumbavoor", state: "Kerala", latitude: 10.1118, longitude: 76.4764 },
    { label: "Muvattupuzha, Kerala", name: "Muvattupuzha", state: "Kerala", latitude: 9.9818, longitude: 76.5789 },
    { label: "Thodupuzha, Kerala", name: "Thodupuzha", state: "Kerala", latitude: 9.8959, longitude: 76.7184 },
    { label: "Kothamangalam, Kerala", name: "Kothamangalam", state: "Kerala", latitude: 10.0601, longitude: 76.6268 },
    { label: "Cherthala, Kerala", name: "Cherthala", state: "Kerala", latitude: 9.6845, longitude: 76.3331 },
    { label: "Kayamkulam, Kerala", name: "Kayamkulam", state: "Kerala", latitude: 9.1726, longitude: 76.5000 },
    { label: "Mavelikkara, Kerala", name: "Mavelikkara", state: "Kerala", latitude: 9.2674, longitude: 76.5513 },
    { label: "Changanassery, Kerala", name: "Changanassery", state: "Kerala", latitude: 9.4447, longitude: 76.5367 },
    { label: "Thiruvalla, Kerala", name: "Thiruvalla", state: "Kerala", latitude: 9.3835, longitude: 76.5741 },
    { label: "Adoor, Kerala", name: "Adoor", state: "Kerala", latitude: 9.1530, longitude: 76.7356 },
    { label: "Pandalam, Kerala", name: "Pandalam", state: "Kerala", latitude: 9.2312, longitude: 76.6806 },
    { label: "Attingal, Kerala", name: "Attingal", state: "Kerala", latitude: 8.6963, longitude: 76.8141 },
    { label: "Neyyattinkara, Kerala", name: "Neyyattinkara", state: "Kerala", latitude: 8.4035, longitude: 77.0863 },
    { label: "Nedumangad, Kerala", name: "Nedumangad", state: "Kerala", latitude: 8.6015, longitude: 77.0028 },
    { label: "Hosur, Tamil Nadu", name: "Hosur", state: "Tamil Nadu", latitude: 12.7409, longitude: 77.8253 },
    { label: "Krishnagiri, Tamil Nadu", name: "Krishnagiri", state: "Tamil Nadu", latitude: 12.5266, longitude: 78.2144 },
    { label: "Dharmapuri, Tamil Nadu", name: "Dharmapuri", state: "Tamil Nadu", latitude: 12.1211, longitude: 78.1582 },
    { label: "Karur, Tamil Nadu", name: "Karur", state: "Tamil Nadu", latitude: 10.9601, longitude: 78.0766 },
    { label: "Namakkal, Tamil Nadu", name: "Namakkal", state: "Tamil Nadu", latitude: 11.2189, longitude: 78.1674 },
    { label: "Thanjavur, Tamil Nadu", name: "Thanjavur", state: "Tamil Nadu", latitude: 10.7870, longitude: 79.1378 },
    { label: "Tiruchirappalli (Trichy), Tamil Nadu", name: "Tiruchirappalli", state: "Tamil Nadu", latitude: 10.7905, longitude: 78.7047 },
    { label: "Theni, Tamil Nadu", name: "Theni", state: "Tamil Nadu", latitude: 10.0104, longitude: 77.4768 }
  ];

  function searchOfflinePlaces(query) {
    if (!query) return [];
    const q = query.toLowerCase().trim();
    const results = [];

    // 1. Search in comprehensive preset cities & towns
    SOUTH_INDIA_PRESET_PLACES.forEach(p => {
      if (p.label.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)) {
        results.push({
          label: p.label,
          latitude: p.latitude,
          longitude: p.longitude,
          source: "preset"
        });
      }
    });

    // 2. Search in all 183 loaded Bolt.Earth charging stations
    if (allStations && allStations.length > 0) {
      allStations.forEach(s => {
        const nameMatch = s.name && s.name.toLowerCase().includes(q);
        const addrMatch = s.address && s.address.toLowerCase().includes(q);
        const idMatch = s.id && s.id.toLowerCase().includes(q);
        if (nameMatch || addrMatch || idMatch) {
          results.push({
            label: `⚡ ${s.name} (${s.address || s.state || 'Station'})`,
            latitude: s.latitude,
            longitude: s.longitude,
            source: "station"
          });
        }
      });
    }

    return results.slice(0, 7);
  }

  async function geocodeQuery(query) {
    const q = query.trim();
    if (q.length < 2) return [];

    // Instant offline matches
    const offlineMatches = searchOfflinePlaces(q);

    // If running in local web mode with server available
    if (window.location.protocol.startsWith("http")) {
      try {
        const resp = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        if (resp.ok) {
          const data = await resp.json();
          if (data.results && data.results.length > 0) {
            return data.results;
          }
        }
      } catch (_) {}
    }

    // Direct online geocoding via Photon Komoot (works worldwide on Android mobile data / Wi-Fi)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2400);
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=10.5&lon=77.0&limit=6`;
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (resp.ok) {
        const data = await resp.json();
        const onlinePlaces = [];
        for (const feat of (data.features || [])) {
          const p = feat.properties || {};
          const coords = feat.geometry ? feat.geometry.coordinates : null;
          if (coords && coords.length >= 2) {
            const parts = [p.name];
            if (p.city && p.city !== p.name) parts.push(p.city);
            if (p.state) parts.push(p.state);
            onlinePlaces.push({
              label: parts.filter(Boolean).join(", "),
              latitude: coords[1],
              longitude: coords[0]
            });
          }
        }
        if (onlinePlaces.length > 0) {
          // Merge unique results
          const seen = new Set();
          const merged = [];
          [...onlinePlaces, ...offlineMatches].forEach(item => {
            const key = `${item.latitude.toFixed(3)},${item.longitude.toFixed(3)}`;
            if (!seen.has(key)) {
              seen.add(key);
              merged.push(item);
            }
          });
          return merged.slice(0, 8);
        }
      }
    } catch (_) {}

    return offlineMatches;
  }

  async function resolveLocationInput(text, fallbackCoords) {
    if (!text || !text.trim()) return fallbackCoords;
    const clean = text.trim();

    // Check if input is already "lat, lng" format
    const coordMatch = clean.match(/^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/);
    if (coordMatch) {
      return [parseFloat(coordMatch[1]), parseFloat(coordMatch[3])];
    }

    // Check offline dictionary first (instant exact match)
    const offlineList = searchOfflinePlaces(clean);
    if (offlineList.length > 0) {
      return [offlineList[0].latitude, offlineList[0].longitude];
    }

    // Try geocoder
    try {
      const places = await geocodeQuery(clean);
      if (places && places.length > 0) {
        return [places[0].latitude, places[0].longitude];
      }
    } catch (_) {}

    return fallbackCoords;
  }

  function setupAutocomplete(inputEl, dropdownEl, onSelect) {
    let debounceTimer = null;

    inputEl.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      const query = inputEl.value.trim();
      if (query.length < 2) {
        dropdownEl.classList.remove("active");
        return;
      }

      // Show instant offline suggestions immediately (0ms delay)
      const instantMatches = searchOfflinePlaces(query);
      if (instantMatches.length > 0) {
        renderDropdown(dropdownEl, instantMatches, (place) => {
          inputEl.value = place.label.replace(/^⚡\s*/, "");
          dropdownEl.classList.remove("active");
          onSelect(place.latitude, place.longitude, place.label);
        });
      }

      // Query online geocoder after debounce for additional results
      debounceTimer = setTimeout(async () => {
        try {
          const places = await geocodeQuery(query);
          if (places && places.length > 0) {
            renderDropdown(dropdownEl, places, (place) => {
              inputEl.value = place.label.replace(/^⚡\s*/, "");
              dropdownEl.classList.remove("active");
              onSelect(place.latitude, place.longitude, place.label);
            });
          }
        } catch (e) {
          console.error("Geocode error:", e);
        }
      }, 200);
    });

    // Auto-resolve on blur / change
    inputEl.addEventListener("change", async () => {
      const val = inputEl.value.trim();
      if (val.length >= 2) {
        const resolved = await resolveLocationInput(val, null);
        if (resolved) {
          onSelect(resolved[0], resolved[1], val);
        }
      }
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

  setupAutocomplete(originInput, originDropdown, (lat, lng, label) => {
    currentOriginCoords = [lat, lng];
    if (label) originInput.value = label.replace(/^⚡\s*/, "");
  });

  setupAutocomplete(destInput, destDropdown, (lat, lng, label) => {
    currentDestCoords = [lat, lng];
    if (label) destInput.value = label.replace(/^⚡\s*/, "");
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
    planSpinner.style.display = "inline-block";
    btnPlanRoute.disabled = true;

    try {
      // 1. Auto-resolve typed location text if user typed without picking from dropdown
      if (originInput.value && originInput.value.trim()) {
        const resolvedOrigin = await resolveLocationInput(originInput.value.trim(), currentOriginCoords);
        if (resolvedOrigin) currentOriginCoords = resolvedOrigin;
      }
      if (destInput.value && destInput.value.trim()) {
        const resolvedDest = await resolveLocationInput(destInput.value.trim(), currentDestCoords);
        if (resolvedDest) currentDestCoords = resolvedDest;
      }

      if (!currentOriginCoords || !currentDestCoords) {
        if (!isSilent) alert("Please enter both an Origin and Destination location.");
        return;
      }

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

    let route = null;
    let coords = [];
    let totalDistKm = 0;
    let totalDurationMin = 0;

    // Multi-provider OSRM routing with timeout & failover
    const routingProviders = [
      `https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${dest[1]},${dest[0]}?overview=full&geometries=geojson&steps=true`,
      `https://routing.openstreetmap.de/routed-car/route/v1/driving/${origin[1]},${origin[0]};${dest[1]},${dest[0]}?overview=full&geometries=geojson&steps=true`
    ];

    for (const pUrl of routingProviders) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5500);
        const osrmResp = await fetch(pUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (osrmResp.ok) {
          const osrmData = await osrmResp.json();
          if (osrmData.routes && osrmData.routes.length > 0) {
            route = osrmData.routes[0];
            totalDistKm = route.distance / 1000.0;
            totalDurationMin = route.duration / 60.0;
            coords = route.geometry.coordinates;
            break;
          }
        }
      } catch (provErr) {
        console.warn("Routing provider notice:", provErr);
      }
    }

    // Intelligent geodesic highway path fallback if offline or OSRM unavailable
    if (!coords || coords.length < 2) {
      const straightDist = distKmBetween(origin[0], origin[1], dest[0], dest[1]);
      totalDistKm = Math.round(straightDist * 1.22 * 10) / 10; // ~1.22x highway road winding factor
      totalDurationMin = Math.round((totalDistKm / 42.0) * 60); // ~42 km/h average two-wheeler pace
      coords = [];
      const steps = 25;
      for (let s = 0; s <= steps; s++) {
        const ratio = s / steps;
        // Add subtle highway curvature
        const arcOffset = Math.sin(ratio * Math.PI) * 0.02;
        const curLat = origin[0] + ratio * (dest[0] - origin[0]) + arcOffset;
        const curLng = origin[1] + ratio * (dest[1] - origin[1]);
        coords.push([curLng, curLat]);
      }
    }

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
