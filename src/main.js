import { CONFIG } from "./config.js";
import { resolveLang, applyBasicUIText } from "./i18n.js";
import { initMap, applyBasemap } from "./map/initMap.js";
import { loadAllData } from "./data/loadData.js";
import { computeRoute } from "./route/route.js";
import { addDebugLayers, setDebugLayersVisible, updateDebugOverlay } from "./map/debug.js";
import { startUserSimulation, startRouteSimulation, stopSimulation } from "./map/simulation.js";

(async function start() {
  // Dil ve temel UI
  resolveLang(CONFIG);
  applyBasicUIText();

  // Harita kurulumu
  const { map } = await initMap("map", CONFIG);
  window.__MAP = map;

  addDebugLayers(map);
  if (CONFIG.DEBUG) setDebugLayersVisible(map, true);

  // Veri
  const data = await loadAllData(map, CONFIG);
  window.__DATA = data;

  const state = {
    startCoord: null,
    destCoord: null,
    lastKnown: null,
    followOn: false,
    pickMode: "none",
    profile: "walk",
    data,
    lastHeading: null,
    isSimulating: false
  };

  // Kullanıcı noktası (mavi dot)
  const userDotEl = document.createElement("div");
  userDotEl.className = "user-dot";
  const userHeadingEl = document.createElement("div");
  userHeadingEl.className = "user-heading";
  userHeadingEl.style.display = "none";
  userDotEl.appendChild(userHeadingEl);
  const userDotMarker = new maplibregl.Marker(userDotEl).setLngLat(map.getCenter()).addTo(map);

  /**
   * Konum güncelleme (tek kaynak)
   * @param {number[]} coords [lon,lat]
   */
  function updateUserPosition(coords) {
    state.lastKnown = coords;
    userDotMarker.setLngLat(coords);

    const bearing = getBearingTowardsDest(coords, state.destCoord) ?? state.lastHeading;
    if (bearing != null) {
      userHeadingEl.style.setProperty("--bearing", `${bearing}deg`);
      userHeadingEl.style.display = "block";
    } else {
      userHeadingEl.style.display = "none";
    }
    setSource("me", fcPoint(coords));
  }

  const geoCfg = CONFIG.GEOLOCATION || {};
  const smoothPosition = createPositionFilter(geoCfg.smoothingAlpha ?? 0.25);

  // GPS (gerçek cihaz)
  const simCfg = CONFIG.SIM_USER || {};
  if (!simCfg.enabled && "geolocation" in navigator) {
    try {
      navigator.geolocation.getCurrentPosition(() => {}, () => {}, { enableHighAccuracy: true, timeout: 10000 });
    } catch {}
    navigator.geolocation.watchPosition(
      (p) => {
        // Gerçek GPS geldiğinde simülasyonları durdur.
        stopSimulation();
        state.isSimulating = false;

        const raw = [p.coords.longitude, p.coords.latitude];
        const filtered = smoothPosition(raw);
        if (!filtered) return;

        updateUserPosition(filtered);

        const speed = Number.isFinite(p.coords.speed) ? p.coords.speed : 0;
        const heading = normalizeHeading(p.coords.heading);
        if (heading != null && speed >= (geoCfg.headingMinSpeedMS ?? 0.5)) {
          state.lastHeading = heading;
        }

        setHeadingTrail(filtered, state.lastHeading);
        if (state.followOn) {
          map.easeTo({ center: filtered, duration: 600, easing: (t) => t });
        }
      },
      (err) => {
        console.warn("[geolocation]", err?.message || err);
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
    );
  }

  // UI
  const { setupUIBindings, initBottomSheet } = await import("./ui/ui.js");
  setupUIBindings({
    map,
    state,
    onRoute: routeNow,
    onProfileChange: (p) => {
      state.profile = p;
    }
  });
  initBottomSheet();

  const restartDemo = () => {
    stopSimulation();
    state.isSimulating = false;
    if (simCfg.enabled) startUserSimulation(map, updateUserPosition);
  };
  document.getElementById("clearRoute")?.addEventListener("click", restartDemo);
  document.getElementById("reset")?.addEventListener("click", restartDemo);

  // Sanal kullanıcı (demo)
  if (simCfg.enabled && Array.isArray(simCfg.coord)) {
    map.__SIM_USER_CFG = { center: simCfg.coord, radiusKm: simCfg.radiusKm, loopDurationMs: simCfg.loopDurationMs };
    map.jumpTo({ center: simCfg.coord, zoom: CONFIG.DEFAULT_ZOOM, pitch: CONFIG.DEFAULT_PITCH, bearing: CONFIG.DEFAULT_BEARING });
    updateUserPosition(simCfg.coord);
    startUserSimulation(map, updateUserPosition);
  }

  // Route simülasyonunu route kaynağından başlatır
  function startRouteSimFromCurrentRoute(routeGeo) {
    const route = routeGeo || window.__ROUTE_LAST?.routeGeo || map.getSource("route")?._data;
    if (!route || !route.features?.length) {
      console.warn("[sim] route geo yok, simülasyon başlamadı");
      return;
    }

    const mainLine =
      route.features.find((f) => f.geometry?.type === "LineString" && (f.properties?.role ?? "main") === "main") ||
      route.features.find((f) => f.geometry?.type === "LineString");
    if (!mainLine) {
      console.warn("[sim] main line bulunamadı");
      return;
    }

    const startOnRoute = mainLine.geometry.coordinates?.[0];
    if (startOnRoute) {
      state.startCoord = startOnRoute;
      updateUserPosition(startOnRoute); // rotaya oturt
    }

    stopSimulation(); // varsa demo döngüsünü kes
    requestAnimationFrame(() => {
      try {
        startRouteSimulation(map, route, updateUserPosition, { durationMs: 8000 });
        state.isSimulating = true;
      } catch (err) {
        console.error("[sim] route sim başlatılamadı", err);
      }
    });
  }

  // Basemap
  applyBasemap(map, {
    use3D: CONFIG.FEATURES?.enable3DByDefault === true,
    osmVisible: CONFIG.OSM_VISIBLE,
    osmOpacity: CONFIG.OSM_OPACITY
  });

  // Rota hesaplama
  async function routeNow() {
    if (!state.destCoord) return toast("Lütfen bir hedef seçin.");
    const start = await chooseStart(state, CONFIG);
    if (!start) return toast("Başlangıç bulunamadı. Lütfen başlangıç seçin.");

    state.startCoord = start;
    setSource("start", fcPoint(start));

    const res = computeRoute({
      map,
      routesFC: data.routes,
      startXY: start,
      destXY: state.destCoord,
      profile: state.profile,
      speeds: CONFIG.SPEEDS,
      limits: CONFIG.ROUTE_LIMITS
    });

    if (res?.error) return toast(res.error);

    const dirSum = document.getElementById("dirSum");
    if (dirSum) dirSum.textContent = `${fmtDist(res.totalLenM)} · ${fmtDur(res.durSec)}`;

    // Rota hazır → simülasyonu otomatik başlat
    requestAnimationFrame(() => startRouteSimFromCurrentRoute(res.routeGeo));

    if (CONFIG.DEBUG) {
      updateDebugOverlay(map, res.graph, [res.Ssnap, res.Tsnap], { showComps: true, showSnaps: true, showDead: true });
    }
  }

  // helpers
  function setSource(id, data) {
    map.getSource(id)?.setData(data);
  }
  function fcPoint(xy) {
    return { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: xy } }] };
  }
  function fcLine(a, b) {
    return { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "LineString", coordinates: [a, b] } }] };
  }
  function emptyFC() {
    return { type: "FeatureCollection", features: [] };
  }
  function toast(msg) {
    const acc = document.getElementById("acc");
    if (!acc) return alert(msg);
    acc.textContent = msg;
    acc.style.display = "block";
    setTimeout(() => (acc.style.display = "none"), 2000);
  }
  function fmtDist(m) {
    return m >= 1000 ? (m / 1000).toFixed(2) + " km" : Math.round(m) + " m";
  }
  function fmtDur(sec) {
    const m = Math.round(sec / 60);
    if (m < 60) return m + " dk";
    const h = Math.floor(m / 60),
      mm = m % 60;
    return h + " sa " + (mm ? mm + " dk" : "");
  }
  function setHeadingTrail(coord, heading) {
    if (!coord || heading == null || !Number.isFinite(heading)) {
      setSource("me-heading", emptyFC());
      return;
    }
    const meters = geoCfg.headingTrailMeters ?? 12;
    const rad = (heading * Math.PI) / 180;
    const north = Math.cos(rad) * meters;
    const east = Math.sin(rad) * meters;
    const latOffset = north / 110540;
    const denom = Math.cos((coord[1] || 0) * Math.PI / 180) * 111320;
    const lonOffset = denom !== 0 ? east / denom : 0;
    const tip = [coord[0] + lonOffset, coord[1] + latOffset];
    setSource("me-heading", fcLine(coord, tip));
  }
  function createPositionFilter(alpha = 0.25) {
    let last = null;
    return (coords) => {
      if (!Array.isArray(coords) || coords.length !== 2) return last;
      if (!last) {
        last = coords;
        return coords;
      }
      const [lx, ly] = last;
      const [x, y] = coords;
      const next = [lx + (x - lx) * alpha, ly + (y - ly) * alpha];
      last = next;
      return next;
    };
  }
  function normalizeHeading(value) {
    if (value == null || Number.isNaN(value)) return null;
    let h = Number(value);
    if (!Number.isFinite(h)) return null;
    h = h % 360;
    if (h < 0) h += 360;
    return h;
  }
  function getBearingTowardsDest(from, to) {
    if (!Array.isArray(from) || !Array.isArray(to)) return null;
    const [lon1, lat1] = from.map((v) => (v * Math.PI) / 180);
    const [lon2, lat2] = to.map((v) => (v * Math.PI) / 180);
    const dLon = lon2 - lon1;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    const brng = (Math.atan2(y, x) * 180) / Math.PI;
    return (brng + 360) % 360;
  }
})();

async function chooseStart(state, CONFIG) {
  const pol = CONFIG.START_POLICY || {};
  const sim = CONFIG.SIM_USER || {};
  const order = pol.priority || ["gps", "poiCategory", "coord"];

  for (const step of order) {
    if (step === "gps" && state.lastKnown) return state.lastKnown;
    if (step === "poiCategory" && state.data?.allFeats?.length) {
      const key = String(pol.fallbackPoiCategory || "reception").toLowerCase();
      const f = state.data.allFeats.find((x) => String(x?.properties?.category || "").toLowerCase() === key);
      if (f?.geometry?.type === "Point") return f.geometry.coordinates;
    }
    if (step === "coord" && Array.isArray(pol.fallbackCoord)) return pol.fallbackCoord;
  }
  if (sim.enabled && Array.isArray(sim.coord)) return sim.coord;
  return null;
}
