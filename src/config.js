/**
 * src/config.js
 * ============================================================
 * OTEL/ORTAM KONFIGURASYONU â€” BASIT ve BOZULMAZ
 * Bu dosyayÄ± dÃ¼zenleyerek otele/ortama uyarlarsÄ±n.
 */

/* ------------------------------------------------------------
 * 1) KIMLIK ve ANAHTARLAR
 * ----------------------------------------------------------*/
const HOTEL_ID = "DEMO";

const MAPBOX_TOKEN = "pk.eyJ1IjoibWFya29rYXJhIiwiYSI6ImNtZ291OGdidDF6MWYya3NneTZjMG44bnkifQ.mWg-QQE8KTdhWZ8TrbMyI";
const MAPTILER_KEY = "ym4UWHwsNK61YUsmqi5C";

/* ------------------------------------------------------------
 * 2) HARITA BOLGE ve KAMERA
 * BBOX: [minLon, minLat, maxLon, maxLat]
 * ----------------------------------------------------------*/
const ORTHO_BOUNDS = [31.799927, 36.591825, 31.812973, 36.602299];
const HOTEL_BBOX   = [31.8020, 36.5957, 31.8083, 36.6016];

const DEFAULT_CENTER  = [31.8055, 36.5985];
const DEFAULT_ZOOM    = 18;
const DEFAULT_PITCH   = 48;
const DEFAULT_BEARING = -45;
const EXTRA_ZOOMOUT   = 0.05;

const OSM_VISIBLE = true;
const OSM_OPACITY = 0.02;

// Harita ilk aÃ§Ä±lÄ±ÅŸ davranÄ±ÅŸÄ±
const FIT_ON_LOAD = false; // true olursa fitBounds yapar, false olursa DEFAULT_ZOOM/CENTER aynen korunur

/* ------------------------------------------------------------
 * 2.5) DEMO / SANAL KULLANICI
 * ----------------------------------------------------------*/
const SIM_USER = {
  enabled: true,                               // gerÃ§ek GPS yerine sanal kullanÄ±cÄ±yÄ± kullan
  coord: [31.804406601974023,36.59843141726124], // baÅŸlangÄ±Ã§ konumu 31.804803348455152, 36.600504133118434//
  radiusKm: 0.007,                              // demo rotasÄ± yarÄ±Ã§apÄ± (km)
  loopDurationMs: 10000             // tam tur sÃ¼resi
};

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
  attribution: "Â© OpenStreetMap contributors",
  opacity : OSM_OPACITY
};

/* ------------------------------------------------------------
 * 3.5) TERRAIN (YÃœKSEKLÄ°K)
 * Terrain dosyalarÄ±n yoksa enabled:false kalsÄ±n.
 * Objenin var olmasÄ±, kod referans verirse hata engeller.
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
const DATA_BASE_URL = "https://aihotels.agency/cdn"; // CDN kÃ¶kÃ¼

const DATA_PATHS = {
  indoor : "https://aihotels.agency/cdn/geojson/indoor.json",
  outdoor: "https://aihotels.agency/cdn/geojson/outdoor.json",
  // Rota motoru yerel grid'i kullansın diye routes'u lokale çektik
  routes : "./data/routes.json",
};

const LOCAL_DATA_PATHS = {
  indoor : "./data/indoor.json",
  outdoor: "./data/outdoor.json",
  routes : "./data/routes.json",
};
const DATA_VERSION = "v1"; // Ä°stersen boÅŸ bÄ±rak; anlÄ±k invalidate iÃ§in ?v=timestamp kullan

/* ------------------------------------------------------------
 * 5) ROTA / PROFIL
 * ----------------------------------------------------------*/
const SPEEDS = { walk: 1.35, bike: 4.5, shuttle: 7.0 }; // m/sn
const ROUTE_LIMITS = {
  MAX_CONNECTOR_M    : 50,
  HIDE_CONNECTOR_LT_M: 50
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
  enabled: false,
  opacity: 0.2,
  color: "#000000",
  beforeLayerId: "indoor-pts-shadow",
  rotationDeg: 150,
  bounds: ORTHO_BOUNDS
};

/* ------------------------------------------------------------
 * 9.5) SABIT TEST KONUMU (OPS) â€” GÃ¼venli kapalÄ±
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
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  DEFAULT_PITCH,
  DEFAULT_BEARING,
  EXTRA_ZOOMOUT,
  FIT_ON_LOAD,

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
  
  SIM_USER,

  MASK,

  FEATURES,
  DEBUG
});

