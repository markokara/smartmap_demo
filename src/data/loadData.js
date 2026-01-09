/**
 * src/data/loadData.js
 * ============================================================
 * indoor / outdoor / routes GeoJSON dosyalarini yukler,
 * MapLibre kaynaklarina setData eder ve birlesik POI dizisini (allFeats) uretir.
 */

import { CONFIG } from "../config.js";

const emptyFC = () => ({ type: "FeatureCollection", features: [] });

const log = (...args) => console.warn("[data]", ...args);

async function safeJson(resp) {
  if (!resp.ok) throw new Error("HTTP " + resp.status);
  const text = await resp.text();
  if (!text || !text.trim()) throw new Error("response body empty");
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error("JSON parse failed: " + (err?.message || err));
  }
}

function ensureFid(fc, prefix) {
  if (!fc || !Array.isArray(fc.features)) return fc || emptyFC();
  fc.features.forEach((f, i) => {
    f.properties = f.properties || {};
    if (!f.properties.fid) f.properties.fid = `${prefix}-${i}-${f.id || "x"}`;
  });
  return fc;
}

function validateRoutes(fc) {
  if (!fc || fc.type !== "FeatureCollection") {
    log("routes: FeatureCollection degil");
    return false;
  }
  const hasLine = (fc.features || []).some((f) => f.geometry && f.geometry.type === "LineString");
  if (!hasLine) {
    log("routes: LineString yok");
    return false;
  }
  return true;
}

async function fetchDataset(url, tag, versionParam) {
  if (!url) return null;
  const withVersion = url.includes("?") ? `${url}&${versionParam}` : `${url}?${versionParam}`;
  try {
    return await safeJson(await fetch(withVersion, { cache: "no-store" }));
  } catch (err) {
    log(`${tag}: ${err?.message || err}`);
    return null;
  }
}

async function loadDataset(tag, primaryUrl, fallbackUrl, versionParam) {
  let data = await fetchDataset(primaryUrl, tag, versionParam);
  if (data && Array.isArray(data.features) && data.features.length) return data;
  if (fallbackUrl) {
    log(`${tag}: primary veri boş/uygunsuz, fallback deneniyor (${fallbackUrl})`);
    data = await fetchDataset(fallbackUrl, `${tag} (fallback)`, versionParam);
    if (data && Array.isArray(data.features) && data.features.length) return data;
  }
  log(`${tag}: veri bulunamadı, boş koleksiyon kullanılacak`);
  return emptyFC();
}

export async function loadAllData(map, cfg = CONFIG) {
  const versionParam = cfg.DATA_VERSION ? `v=${encodeURIComponent(cfg.DATA_VERSION)}` : `v=${Date.now()}`;

  const indoorRaw = await loadDataset("indoor.json", cfg.DATA_PATHS?.indoor, cfg.LOCAL_DATA_PATHS?.indoor, versionParam);
  const outdoorRaw = await loadDataset("outdoor.json", cfg.DATA_PATHS?.outdoor, cfg.LOCAL_DATA_PATHS?.outdoor, versionParam);
  let routesRaw = await loadDataset("routes.json", cfg.DATA_PATHS?.routes, cfg.LOCAL_DATA_PATHS?.routes, versionParam);
  if (!validateRoutes(routesRaw)) routesRaw = emptyFC();

  const indoor = ensureFid(indoorRaw, "in");
  const outdoor = ensureFid(outdoorRaw, "out");

  map.getSource("indoor")?.setData(indoor || emptyFC());
  map.getSource("outdoor")?.setData(outdoor || emptyFC());
  map.getSource("routes")?.setData(routesRaw);

  const indoorFs = (indoor?.features || []).map((f) => ({ ...f, __src: "indoor" }));
  const outdoorFs = (outdoor?.features || []).map((f) => ({ ...f, __src: "outdoor" }));
  const allFeats = indoorFs.concat(outdoorFs);

  return { indoor, outdoor, routes: routesRaw, allFeats };
}
