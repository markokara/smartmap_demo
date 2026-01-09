/**
 * src/map/initMap.js
 * MapLibre baÅŸlangÄ±Ã§ + kaynak/katman kurulumu
 */

import { CONFIG } from "../config.js";
import { ICONS, CAT_COLORS } from "../categories.js";

const emptyFC = () => ({ type: "FeatureCollection", features: [] });

export async function initMap(containerId = "map", cfg = CONFIG) {
  // ---------- 1) HARÄ°TA ----------
  const baseStyle = {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {},
    layers: [{ id: "bg", type: "background", paint: { "background-color": "#0b0d17" } }]
  };

  const [w, s, e, n] = cfg.HOTEL_BBOX;

  const map = new maplibregl.Map({
    container: containerId,
    style: baseStyle,
    center: cfg.DEFAULT_CENTER,
    zoom: cfg.DEFAULT_ZOOM,
    pitch: cfg.DEFAULT_PITCH,
    bearing: cfg.DEFAULT_BEARING,
    maxZoom: 25,
    renderWorldCopies: false,
    attributionControl: false,
    maxBounds: [[w, s], [e, n]]
  });

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
  map.addControl(new maplibregl.AttributionControl({ customAttribution: "Â© aihotelstech" }));

  await new Promise((res) => map.on("load", res));

  // ---------- 2) BAZ KAYNAKLAR ----------
  // MapTiler Satellite (Mapbox alternatifi)
  map.addSource("sat", {
    type: "raster",
    tiles: [
      `https://api.maptiler.com/maps/satellite/{z}/{x}/{y}.jpg?key=${cfg.MAPTILER_KEY}`
    ],
    tileSize: 256,
    attribution: "Â© MapTiler Â© OSM"
  });
  map.addLayer({ id: "sat-lyr", type: "raster", source: "sat", paint: { "raster-opacity": 0.18 } });

  // Yerel ORTOFOTO (XYZ)
  if (cfg.DRONE_TILES?.enabled) {
    map.addSource("drone", {
      type: "raster",
      tiles   : [cfg.DRONE_TILES.template],
      tileSize: 256,
      minzoom : cfg.DRONE_TILES.minzoom ?? 16,
      maxzoom : cfg.DRONE_TILES.maxzoom ?? 21,
      scheme  : cfg.DRONE_TILES.scheme  ?? "xyz",
      bounds  : cfg.DRONE_TILES.bounds  ?? cfg.HOTEL_BBOX
    });
    map.addLayer({
      id: "drone-layer",
      type: "raster",
      source: "drone",
      paint: { "raster-opacity": 1.0 }
    });
  }

  // OSM etiket raster (Ã¼stte, yarÄ± saydam)
  map.addSource("osmRaster", {
    type: "raster",
    tiles: [cfg.LABEL_TILES?.template || "https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    tileSize: 256,
    maxzoom: cfg.LABEL_TILES?.maxzoom ?? 19,
    attribution: cfg.LABEL_TILES?.attribution || "Â© OpenStreetMap contributors"
  });
  map.addLayer({
    id: "osm-raster",
    type: "raster",
    source: "osmRaster",
    paint: { "raster-opacity": cfg.OSM_VISIBLE ? cfg.OSM_OPACITY : 0 }
  });

  // ---------- 3) 3D KAYNAKLAR ----------
  // DEM kaynaÄŸÄ±: Ã¶nce yerel terrain klasÃ¶rÃ¼
  let demSourceAdded = false;
  if (cfg.TERRAIN?.enabled) {
    try {
      map.addSource("dem", {
        type: "raster-dem",
        tiles   : [cfg.TERRAIN.template],   // ./assets/terrain/{z}/{x}/{y}.png
        tileSize: 256,
        minzoom : cfg.TERRAIN.minzoom ?? 16,
        maxzoom : cfg.TERRAIN.maxzoom ?? 21,
        scheme  : cfg.TERRAIN.scheme  ?? "xyz",
        bounds  : cfg.TERRAIN.bounds  ?? cfg.HOTEL_BBOX
      });
      demSourceAdded = true;
    } catch (err) {
      console.warn("[terrain] yerel raster-dem eklenemedi:", err?.message || err);
    }
  }

  // ---------- 4) UYGULAMA VERÄ° KAYNAKLARI ----------
  map.addSource("indoor", { type: "geojson", data: emptyFC(), promoteId: "fid" });
  map.addSource("outdoor", { type: "geojson", data: emptyFC(), promoteId: "fid" });
  map.addSource("routes",  { type: "geojson", data: emptyFC(), promoteId: "fid" });

  map.addSource("start", { type: "geojson", data: emptyFC() });
  map.addSource("dest",  { type: "geojson", data: emptyFC() });
  map.addSource("route", { type: "geojson", data: emptyFC() });
  map.addSource("me",    { type: "geojson", data: emptyFC() });
  map.addSource("me-heading", { type: "geojson", data: emptyFC() });
  map.addSource("debug", { type: "geojson", data: emptyFC() });

  // ---------- 5) Ä°KONLAR ----------
  await loadIcons(map);

  // ---------- 6) KATLAR ----------
  addFeatureLayers(map, "indoor");
  addFeatureLayers(map, "outdoor");

  if (cfg.MASK?.enabled) {
    addOutsideDimMask(
      map,
      cfg.MASK.bounds ?? cfg.HOTEL_BBOX,
      cfg.MASK.opacity,
      cfg.MASK.color,
      cfg.MASK.beforeLayerId,
      cfg.MASK.rotationDeg
    );
  }

  map.addLayer({
    id: "routes-casing",
    type: "line",
    source: "routes",
    paint: {
      "line-color": "#ffffff",
      "line-width": ["+", ["coalesce", ["to-number", ["get", "width"]], ["to-number", ["get", "stroke_w"]], 0.8], 0.4],
      "line-opacity": 0.0
    },
    layout: { "line-cap": "round", "line-join": "round" },
    minzoom: 10
  });
  map.addLayer({
    id: "routes-net",
    type: "line",
    source: "routes",
    paint: {
      "line-color": ["coalesce", ["get", "stroke"], ["get", "fill"], "#6b7280"],
      "line-width": ["coalesce", ["to-number", ["get", "width"]], ["to-number", ["get", "stroke_w"]], ["to-number", ["get", "stroke-width"]], 0.6],
      "line-opacity": 0.08
    },
    layout: { "line-cap": "round", "line-join": "round" },
    minzoom: 10
  });

  map.addLayer({
    id: "route-line",
    type: "line",
    source: "route",
    paint: {
      "line-color": "#1a73e8",
      "line-opacity": 0.92,
      "line-width": ["interpolate", ["linear"], ["zoom"], 14, 6.5, 18, 12, 22, 22],
      "line-blur": 0.3
    },
    layout: { "line-cap": "round", "line-join": "round" },
    filter: ["==", ["get", "role"], "main"]
  });
  map.addLayer({
    id: "route-connector",
    type: "line",
    source: "route",
    paint: { "line-color": "#8ab4f8", "line-width": 3.2, "line-dasharray": [2, 2], "line-opacity": 0.9 },
    layout: { "line-cap": "round", "line-join": "round" },
    filter: ["==", ["get", "role"], "connector"]
  });
  map.addLayer({
    id: "route-arrows",
    type: "symbol",
    source: "route",
    layout: {
      "symbol-placement": "line-center",
      "text-field": ">",
      "text-size": 15,
      "symbol-spacing": 80,
      "text-rotation-alignment": "map",
      "text-keep-upright": false
    },
    paint: { "text-color": "#1a73e8", "text-halo-color": "#fff", "text-halo-width": 1.2 },
    filter: ["==", ["get", "role"], "main"]
  });

  map.addLayer({
    id: "start-pt",
    type: "circle",
    source: "start",
    paint: { "circle-radius": 7, "circle-color": "#22c55e", "circle-stroke-color": "#fff", "circle-stroke-width": 1.8 }
  });
  map.addLayer({
    id: "dest-pt",
    type: "circle",
    source: "dest",
    paint: { "circle-radius": 7, "circle-color": "#ef4444", "circle-stroke-color": "#fff", "circle-stroke-width": 1.8 }
  });
  map.addLayer({
    id: "me-heading",
    type: "line",
    source: "me-heading",
    paint: {
      "line-color": "#1d4ed8",
      "line-width": ["interpolate", ["linear"], ["zoom"], 14, 3, 20, 5],
      "line-opacity": 0.85,
      "line-blur": 0.1
    },
    layout: { "line-cap": "round" }
  });
  map.addLayer({
    id: "me-pt",
    type: "circle",
    source: "me",
    paint: { "circle-radius": 6, "circle-color": "#1d4ed8", "circle-stroke-color": "#fff", "circle-stroke-width": 1.6 }
  });

  // ---------- 7) 3D + OSM OPASÄ°TE ----------
  applyBasemap(map, {
    use3D     : cfg.FEATURES?.enable3DByDefault === true,
    osmVisible: cfg.OSM_VISIBLE,
    osmOpacity: cfg.OSM_OPACITY,
    terrainExaggeration: cfg.TERRAIN?.exaggeration ?? 1.0
  });

  // ---------- 8) FIT / LOCK ----------
  lockToHotel(map, cfg);
  window.addEventListener("resize", () => { map.resize(); lockToHotel(map, cfg); });
  const mq = window.matchMedia("(orientation: landscape)");
  mq?.addEventListener?.("change", () => { map.resize(); lockToHotel(map, cfg); });

  return { map };
}

/* ===== YardÄ±mcÄ±lar =================================================== */

async function loadIcons(map) {
  const defaultFile = ICONS.default || "poi-marker-default.png";
  let defaultImage = null;

  async function loadBitmap(file) {
    const url = `./assets/icons/${file}`.replace(/\/\.\//g, "/");
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const buf = await resp.arrayBuffer();
    return createImageBitmap(new Blob([buf]));
  }

  async function addIcon(id, file, fallbackBmp) {
    if (map.hasImage(id)) return fallbackBmp;
    try {
      const bmp = await loadBitmap(file);
      map.addImage(id, bmp);
      return bmp;
    } catch (err) {
      if (fallbackBmp) {
        console.warn(`[icons] ${file} icin fallback ikon kullaniliyor`, err?.message || err);
        map.addImage(id, fallbackBmp);
        return fallbackBmp;
      }
      console.warn("[icons] yuklenemedi:", file, err?.message || err);
      return null;
    }
  }

  defaultImage = await addIcon("poi-default", defaultFile, null);

  for (const [cat, file] of Object.entries(ICONS)) {
    if (cat === "default") continue;
    defaultImage = await addIcon(`poi-${cat}`, file, defaultImage || null) || defaultImage;
  }
}
function addFeatureLayers(map, src) {
  map.addLayer({
    id: `${src}-fill`,
    type: "fill",
    source: src,
    paint: { "fill-color": ["coalesce", ["get", "fill"], "#2563eb"], "fill-opacity": ["coalesce", ["get", "fill_op"], 0.35] }
  });

  map.addLayer({
    id: `${src}-fill-outline`,
    type: "line",
    source: src,
    filter: ["==", ["geometry-type"], "Polygon"],
    paint: { "line-color": ["coalesce", ["get", "stroke"], "#2563eb"], "line-width": ["coalesce", ["get", "stroke_w"], 1.6] }
  });

  map.addLayer({
    id: `${src}-line`,
    type: "line",
    source: src,
    filter: ["==", ["geometry-type"], "LineString"],
    paint: { "line-color": ["coalesce", ["get", "stroke"], "#2563eb"], "line-width": ["coalesce", ["get", "stroke_w"], 2.5] }
  });

  map.addLayer({
    id: `${src}-pts-shadow`,
    type: "circle",
    source: src,
    filter: ["==", ["geometry-type"], "Point"],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 9, 18, 13, 22, 18],
      "circle-color": "rgba(0,0,0,0.28)",
      "circle-translate": [0, 2],
      "circle-blur": 0.6
    }
  });

  map.addLayer({
    id: `${src}-pts-badge`,
    type: "circle",
    source: src,
    filter: ["==", ["geometry-type"], "Point"],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 11, 18, 17, 22, 25],
      "circle-color": [
        "match", ["get", "category"],
        "restaurant", CAT_COLORS.restaurant,
        "bar",        CAT_COLORS.bar,
        "spa",        CAT_COLORS.spa,
        "cafe",       CAT_COLORS.cafe,
        "shop",       CAT_COLORS.shop,
        "toilet",     CAT_COLORS.toilet,
        "reception",  CAT_COLORS.reception,
        "beach",      CAT_COLORS.beach,
        "kidsclub",   CAT_COLORS.kidsclub,
        "elevator",   CAT_COLORS.elevator,
        "gate",       CAT_COLORS.gate,
        "parking",    CAT_COLORS.parking,
        "shuttle",    CAT_COLORS.shuttle,
        "gym",        CAT_COLORS.gym,
        "voleybol",   CAT_COLORS.voleybol,
        "pool",       CAT_COLORS.pool,
        CAT_COLORS.default
      ],
      "circle-stroke-color": "#FFFFFF",
      "circle-stroke-width": 2,
      "circle-pitch-scale": "viewport"
    }
  });

  map.addLayer({
    id: `${src}-pts`,
    type: "symbol",
    source: src,
    filter: ["==", ["geometry-type"], "Point"],
    layout: {
      "icon-image": [
        "match", ["get", "category"],
        "restaurant", "poi-restaurant",
        "bar",        "poi-bar",
        "spa",        "poi-spa",
        "cafe",       "poi-cafe",
        "shop",       "poi-shop",
        "toilet",     "poi-toilet",
        "reception",  "poi-reception",
        "beach",      "poi-beach",
        "kidsclub",   "poi-kidsclub",
        "elevator",   "poi-default",
        "gate",       "poi-default",
        "parking",    "poi-parking",
        "shuttle",    "poi-shuttle",
        "gym",        "poi-gym",
        "voleybol",   "poi-voleybol",
        "pool",       "poi-pool",
        "poi-default"
      ],
      "icon-size": ["interpolate", ["linear"], ["zoom"], 14, 0.9, 18, 1.1, 22, 1.25],
      "icon-allow-overlap": true,
      "icon-anchor": "center"
    }
  });
}

function addOutsideDimMask(map, bounds, opacity = 0.55, color = "#000", beforeLayerId = null, angleDeg = 0) {
  const [[W, S], [E, N]] = [[bounds[0], bounds[1]], [bounds[2], bounds[3]]];
  const center = [(W + E) / 2, (S + N) / 2];
  const worldRing = [[-179.99, -85], [179.99, -85], [179.99, 85], [-179.99, 85], [-179.99, -85]];
  const innerRaw = [[W, S], [E, S], [E, N], [W, N], [W, S]];
  const inner = angleDeg ? rotateRing(innerRaw, center, angleDeg) : innerRaw;

  const fc = { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [worldRing, inner] } }] };

  if (!map.getSource("outside-dim")) map.addSource("outside-dim", { type: "geojson", data: fc });
  else map.getSource("outside-dim").setData(fc);

  if (!map.getLayer("outside-dim")) {
    const layer = { id: "outside-dim", type: "fill", source: "outside-dim", paint: { "fill-color": color, "fill-opacity": opacity } };
    if (beforeLayerId && map.getLayer(beforeLayerId)) map.addLayer(layer, beforeLayerId);
    else map.addLayer(layer);
  } else {
    map.setPaintProperty("outside-dim", "fill-color", color);
    map.setPaintProperty("outside-dim", "fill-opacity", opacity);
  }

  function rotateRing(ring, [cx, cy], angleDeg2) {
    const a = (angleDeg2 * Math.PI) / 180;
    const cos = Math.cos(a), sin = Math.sin(a);
    const out = ring.map(([x, y]) => {
      const dx = x - cx, dy = y - cy;
      return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
    });
    const f = out[0], l = out[out.length - 1];
    if (f[0] !== l[0] || f[1] !== l[1]) out.push([...f]);
    return out;
  }
}

let warnedNo3DSource = false;

export function applyBasemap(map, opts = {}) {
  const { use3D = false, osmVisible = true, osmOpacity = 0.05, terrainExaggeration = 1.0 } = opts;

  if (map.getLayer("osm-raster")) map.setPaintProperty("osm-raster", "raster-opacity", osmVisible ? osmOpacity : 0);

  const hasOmtSource = !!map.getSource("omt");
  const enable3D = use3D && hasOmtSource;

  if (use3D && !hasOmtSource && !warnedNo3DSource) {
    console.warn("[3d] VektÃ¶r veri kaynaÄŸÄ± bulunamadÄ±ÄŸÄ± iÃ§in 3D katmanlar devre dÄ±ÅŸÄ± bÄ±rakÄ±ldÄ±.");
    warnedNo3DSource = true;
  }

  if (enable3D) {
    if (!map.getLayer("bldg-3d")) {
      map.addLayer({
        id: "bldg-3d",
        type: "fill-extrusion",
        source: "omt",
        "source-layer": "building",
        layout: { visibility: "visible" },
        paint: {
          "fill-extrusion-color": "#b9c9d6",
          "fill-extrusion-opacity": 0.85,
          "fill-extrusion-height": ["coalesce", ["to-number", ["get", "render_height"]], ["to-number", ["get", "height"]], 6],
          "fill-extrusion-base"  : ["coalesce", ["to-number", ["get", "render_min_height"]], ["to-number", ["get", "min_height"]], 0]
        },
        minzoom: 14
      });
    } else {
      map.setLayoutProperty("bldg-3d", "visibility", "visible");
    }

    // Terrain'i etkinleÅŸtir
    if (map.getSource("dem")) map.setTerrain({ source: "dem", exaggeration: terrainExaggeration });

    if (!map.getLayer("sky")) {
      map.addLayer({ id: "sky", type: "sky", paint: { "sky-type": "atmosphere", "sky-atmosphere-sun": [0, 45], "sky-atmosphere-sun-intensity": 10 } });
    }
  } else {
    if (map.getLayer("sky")) map.removeLayer("sky");
    map.setTerrain(null);
    if (map.getLayer("bldg-3d")) map.setLayoutProperty("bldg-3d", "visibility", "none");
  }
}

function lockToHotel(map, cfg) {
  const isLandscape = window.innerWidth > window.innerHeight;
  const PAD_LAND = { top: 20, right: 20, bottom: 20, left: 20 };
  const PAD_PORT = { top: 36, right: 14, bottom: 96, left: 14 };

  const fitBox = cfg.DRONE_TILES?.bounds ?? cfg.HOTEL_BBOX;
  if (cfg.FIT_ON_LOAD !== false) {
    map.fitBounds([[fitBox[0], fitBox[1]], [fitBox[2], fitBox[3]]], {
      padding: isLandscape ? PAD_LAND : PAD_PORT,
      maxZoom: 25,
      pitch: cfg.DEFAULT_PITCH,
      bearing: cfg.DEFAULT_BEARING
    });

    requestAnimationFrame(() => {
      const fitZ = map.getZoom();
      map.setMinZoom(Math.max(0, fitZ - (cfg.EXTRA_ZOOMOUT ?? 0.6)));
    });
  } else {
    const baseMin = Math.max(0, (cfg.DEFAULT_ZOOM ?? 0) - (cfg.EXTRA_ZOOMOUT ?? 0.6));
    map.setMinZoom(baseMin);
  }

  const boundsForMax = cfg.MAX_BOUNDS ?? cfg.MASK?.bounds ?? cfg.HOTEL_BBOX;
  const padded = expandBoundsMeters([[boundsForMax[0], boundsForMax[1]], [boundsForMax[2], boundsForMax[3]]], 300);
  map.setMaxBounds(padded);
}

function expandBoundsMeters(bounds, m = 100) {
  const [[w, s], [e, n]] = bounds;
  const lat = (s + n) / 2;
  const dLat = m / 110540;
  const dLon = m / (111320 * Math.cos((lat * Math.PI) / 180));
  return [[w - dLon, s - dLat], [e + dLon, n + dLat]];
}






