/**
 * src/config.js
 * ============================================================
 * OTEL/ORTAM KONFIGURASYONU — BASIT ve BOZULMAZ
 * Bu dosyayı düzenleyerek otele/ortama uyarlarsın.
 */

/* ------------------------------------------------------------
 * 1) KIMLIK ve ANAHTARLAR
 * ----------------------------------------------------------*/
const HOTEL_ID = "longbeach";

const MAPBOX_TOKEN = "pk.eyJ1IjoibWFya29rYXJhIiwiYSI6ImNtZ291OGdidDF6MWYya3NneTZjMG44bnkifQ.mWg-QQE8KTdhWZ8TrbMyIQ";
const MAPTILER_KEY = "ym4UWHwsNK61YUsmqi5C";

/* ------------------------------------------------------------
 * 2) HARITA BOLGE ve KAMERA
 * BBOX: [minLon, minLat, maxLon, maxLat]
 * ----------------------------------------------------------*/
const ORTHO_BOUNDS = [31.799927, 36.591825, 31.812973, 36.602299];
const HOTEL_BBOX   = [31.8020, 36.5957, 31.8083, 36.6016];

const DEFAULT_PITCH   = 60;
const DEFAULT_BEARING = 35;
const EXTRA_ZOOMOUT   = 0.35;

const OSM_VISIBLE = true;
const OSM_OPACITY = 0.05;

/* ------------------------------------------------------------
 * 3) DRONE / ORTOFOTO TILES (XYZ)
 * ----------------------------------------------------------*/
const DRONE_TILES = {
  enabled : true,
  template: "https://aihotels.agency/cdn/smartmap_v1/tiles/{z}/{x}/{y}.png",
  minzoom : 16,
  maxzoom : 21,
  scheme  : "xyz",
  bounds  : ORTHO_BOUNDS
};

const LABEL_TILES = {
  enabled : false,
  template: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  minzoom : 14,
  maxzoom : 19,
  attribution: "© OpenStreetMap contributors",
  opacity : OSM_OPACITY
};

/* ------------------------------------------------------------
 * 3.5) TERRAIN (YÜKSEKLİK)
 * Terrain dosyaların yoksa enabled:false kalsın.
 * Objenin var olması, kod referans verirse hata engeller.
 * ----------------------------------------------------------*/
const TERRAIN = {
  enabled : false,
  template: "https://aihotels.agency/cdn/smartmap_v1/terrain/{z}/{x}/{y}.png",
  minzoom : 16,
  maxzoom : 21,
  scheme  : "xyz",
  bounds  : ORTHO_BOUNDS,
  fallbackToMapTiler: true,
  exaggeration: 1.15
};

/* ------------------------------------------------------------
 * 4) VERI DOSYALARI (GeoJSON)
 * ----------------------------------------------------------*/
const DATA_BASE_URL = "https://aihotels.agency/cdn"; // CDN kökü

const DATA_PATHS = {
  indoor : "https://aihotels.agency/cdn/geojson/indoor.json",
  outdoor: "https://aihotels.agency/cdn/geojson/outdoor.json",
  routes : "https://aihotels.agency/cdn/geojson/routes.json",
};

const LOCAL_DATA_PATHS = {
  indoor : "./data/indoor.json",
  outdoor: "./data/outdoor.json",
  routes : "./data/routes.json",
};
const DATA_VERSION = "v1"; // İstersen boş bırak; anlık invalidate için ?v=timestamp kullan

/* ------------------------------------------------------------
 * 5) ROTA / PROFIL
 * ----------------------------------------------------------*/
const SPEEDS = { walk: 1.35, bike: 4.5, shuttle: 7.0 }; // m/sn
const ROUTE_LIMITS = {
  MAX_CONNECTOR_M    : 30,
  HIDE_CONNECTOR_LT_M: 5
};

/* ------------------------------------------------------------
 * 6) DIL ve OZELLIKLER
 * ----------------------------------------------------------*/
const FEATURES = {
  defaultLanguage   : "en",
  enable3DByDefault : false
};

/* ------------------------------------------------------------
 * 7) BASLANGIC SECME POLITIKASI
 * ----------------------------------------------------------*/
const START_POLICY = {
  showPickStartButton: true,
  priority: ["gps", "poiCategory","coord"],
  fallbackPoiCategory: "reception",
  fallbackCoord: [31.805000, 36.599000]
};

/* ------------------------------------------------------------
 * 8) KONUM TAKIBI (GPS)
 * ----------------------------------------------------------*/
const GEOLOCATION = {
  smoothingAlpha    : 0.25,
  headingMinSpeedMS : 0.5,
  headingTrailMeters: 12
};

/* ------------------------------------------------------------
 * 9) HARICI MASKE
 * ----------------------------------------------------------*/
const MASK = {
  enabled: true,
  opacity: 0.55,
  color: "#000000",
  beforeLayerId: "indoor-pts-shadow",
  rotationDeg: 150,
  bounds: ORTHO_BOUNDS
};

/* ------------------------------------------------------------
 * 9.5) SABIT TEST KONUMU (OPS) — Güvenli kapalı
 * ----------------------------------------------------------*/
const TEST_POSITION = {
  enabled   : false,
  coord     : [31.804803348455152, 36.600504133118434],
  autoFollow: true,
  accuracy  : 5,
  zoom      : 20
};

/* ------------------------------------------------------------
 * 10) DEBUG
 * ----------------------------------------------------------*/
const DEBUG = false;

export const CONFIG = Object.freeze({
  HOTEL_ID,
  MAPBOX_TOKEN,
  MAPTILER_KEY,

  HOTEL_BBOX,
  DEFAULT_PITCH,
  DEFAULT_BEARING,
  EXTRA_ZOOMOUT,

  OSM_VISIBLE,
  OSM_OPACITY,

  DRONE_TILES,
  LABEL_TILES,
  TERRAIN,          // terrain yoksa bile obje export ediliyor
  DATA_BASE_URL,
  DATA_PATHS,
  LOCAL_DATA_PATHS,
  DATA_VERSION,

  SPEEDS,
  ROUTE_LIMITS,
  START_POLICY,
  GEOLOCATION,
  TEST_POSITION,

  MASK,

  FEATURES,
  DEBUG
});
