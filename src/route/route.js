/**
 * src/route/route.js
 * ============================================================
 * ROTA MOTORU
 * - buildRouteGraph(routesFC): routes.json'dan (LineString ağı) graf kurar.
 * - computeRoute({ map, routesFC, startXY, destXY, profile, speeds, limits }):
 *     snap → geçici düğüm ekle → dijkstra → geojson çiz → süre/mesafe döndür.
 *
 * ÖZELLİKLER (orijinal koddaki tüm mantık korunmuştur):
 * - SNAP: tüm LineString'ler üzerinde nearestPointOnLine (turf) ile snap alır
 * - GEÇİCİ DÜ�?ÜM: A–B kenarını S noktasında ikiye böler (Sid/Tid)
 * - DIJKSTRA: mod kısıtlı (walk/bike/shuttle), kenar w = METRE
 * - CONNECTOR: start/dest → snap arası bağlayıcıyı çizer (uzunsa)
 * - LIMITLER: MAX_CONNECTOR_M, HIDE_CONNECTOR_LT_M (CONFIG.ROUTE_LIMITS)
 * - HIZLAR: SPEEDS (m/sn) → süre hesabı
 * - DEBUG: Ssnap, Tsnap ve graph referansı döndürür (overlay için)
 *
 * DI�? BA�?IMLILIK:
 * - turf (global; index.html'den <script src="@turf/turf"> ile geliyor)
 */

import { CONFIG } from "../config.js";

// ==================== Yardımcılar ====================
const emptyFC = () => ({ type: "FeatureCollection", features: [] });
const LOG_PREFIX = "[route]";

function routeDebugEnabled() {
  const g = typeof globalThis !== "undefined" ? globalThis : {};
  if (typeof g.__ROUTE_DEBUG === "boolean") return g.__ROUTE_DEBUG;
  if (typeof CONFIG?.DEBUG === "boolean") return CONFIG.DEBUG;
  return true;
}
function logDebug(...args) {
  if (routeDebugEnabled()) console.debug(LOG_PREFIX, ...args);
}
function logInfo(...args) {
  if (routeDebugEnabled()) console.info(LOG_PREFIX, ...args);
}
function logWarn(...args) {
  console.warn(LOG_PREFIX, ...args);
}
function logGroupStart(label, payload) {
  if (!routeDebugEnabled()) return false;
  if (typeof console.groupCollapsed === "function") {
    console.groupCollapsed(`${LOG_PREFIX} ${label}`, payload || "");
    return true;
  }
  logDebug(label, payload);
  return false;
}
function logGroupEnd(started) {
  if (started && typeof console.groupEnd === "function") console.groupEnd();
}

// Haversine ile metre
function meters(a, b) {
  return turf.distance(turf.point(a), turf.point(b), { units: "meters" });
}
function totalLength(coords) {
  let s = 0;
  for (let i = 1; i < coords.length; i++) s += meters(coords[i - 1], coords[i]);
  return s;
}

// ==================== GRAF ====================
/**
 * buildRouteGraph(routesFC)
 *   routesFC LineString’lerinden graf üretir.
 *   Kenarlar çift yönlüdür. Kenar ağırlığı = METRE.
 *   modes: feature.properties.modes ("walk,bike,shuttle") → Set'e çevrilir.
 *
 * Dönüş:
 *   {
 *     nodes: [{id, xy}],      // xy = [lon,lat]
 *     adj:   { nodeId: [ {to, w, modes:Set} ] },
 *     idOf:  Map("lon,lat"->id),
 *     getId(xy, forceNew=false), addEdge(aId,bId,w,meta), removeEdge(aId,bId)
 *   }
 */
export function buildRouteGraph(routesFC) {
  const nodes = [];
  const idOf = new Map();   // "lon,lat" → nodeId
  const adj = {};           // nodeId → [{to,w,modes}]

  const key = (xy) => xy[0].toFixed(7) + "," + xy[1].toFixed(7);
  const projector = createProjector(routesFC);
  const edges = [];

  function getId(xy, forceNew = false) {
    const k = key(xy);
    if (!forceNew && idOf.has(k)) return idOf.get(k);

    // Yakın düğüme bağlama toleransı (2m) — düğüm patlamasını önler
    if (!forceNew) {
      const TOL_M = 2.0;
      for (let i = 0; i < nodes.length; i++) {
        const dist = meters(nodes[i].xy, xy);
        if (dist <= TOL_M) {
          idOf.set(k, nodes[i].id);
          return nodes[i].id;
        }
      }
    }

    const id = nodes.length;
    idOf.set(k, id);
    nodes.push({ id, xy });
    if (!adj[id]) adj[id] = [];
    return id;
  }

  function addEdge(aId, bId, w, meta) {
    const modes = (meta?.modes) || new Set(["walk", "bike", "shuttle"]);
    adj[aId].push({ to: bId, w, modes });
    adj[bId].push({ to: aId, w, modes });
  }
  function removeEdge(aId, bId) {
    adj[aId] = (adj[aId] || []).filter((e) => e.to !== bId);
    adj[bId] = (adj[bId] || []).filter((e) => e.to !== aId);
  }

  (routesFC?.features || []).forEach((f, fi) => {
    if (!f.geometry || f.geometry.type !== "LineString") return;
    const c = f.geometry.coordinates || [];
    const modes = new Set(
      String(f.properties?.modes || "walk,bike,shuttle")
        .split(/[,\s;]+/)
        .filter(Boolean)
    );
    for (let i = 1; i < c.length; i++) {
      const aId = getId(c[i - 1]);
      const bId = getId(c[i]);
      const w = meters(c[i - 1], c[i]); // METRE
      addEdge(aId, bId, w, { modes });

      const projA = projector.project(c[i - 1]);
      const projB = projector.project(c[i]);
      edges.push({
        id: edges.length,
        featureIndex: fi,
        segmentIndex: i - 1,
        a: c[i - 1],
        b: c[i],
        aId,
        bId,
        modes,
        projA,
        projB,
        minX: Math.min(projA[0], projB[0]),
        maxX: Math.max(projA[0], projB[0]),
        minY: Math.min(projA[1], projB[1]),
        maxY: Math.max(projA[1], projB[1]),
        cuts: new Map()
      });
    }
  });

  const graph = { nodes, adj, idOf, getId, addEdge, removeEdge };
  const enhStats = enhanceGraphConnectivity(graph, edges);

  const totalDirEdges = Object.values(adj).reduce((sum, list) => sum + (list?.length || 0), 0);
  const uniqueEdges = totalDirEdges / 2;
  logDebug("graph built", {
    nodes: nodes.length,
    segments: edges.length,
    edges: uniqueEdges,
    cuts: enhStats?.cuts || 0,
    connectorsPlanned: enhStats?.connectorsPlanned || 0,
    connectorsAdded: enhStats?.connectorsAdded || 0,
    snapMerges: enhStats?.snapMerges || 0
  });
  return graph;
}

const EDGE_CONNECT_TOL_M = 20;
const SAME_POINT_EPS_M = 0.75;
const CUT_T_EPS = 1e-5;

function createProjector(routesFC) {
  let baseLon = 0;
  let baseLat = 0;
  let found = false;

  for (const feat of routesFC?.features || []) {
    if (!feat?.geometry || feat.geometry.type !== "LineString") continue;
    const coords = feat.geometry.coordinates || [];
    for (const xy of coords) {
      if (Array.isArray(xy) && xy.length >= 2) {
        baseLon = xy[0];
        baseLat = xy[1];
        found = true;
        break;
      }
    }
    if (found) break;
  }

  const cosLat = Math.cos((baseLat * Math.PI) / 180) || 1;
  const meterPerLon = 111320 * cosLat;
  const meterPerLat = 110540;

  return {
    project(xy = [baseLon, baseLat]) {
      const lon = xy[0] ?? baseLon;
      const lat = xy[1] ?? baseLat;
      return [(lon - baseLon) * meterPerLon, (lat - baseLat) * meterPerLat];
    }
  };
}

function enhanceGraphConnectivity(graph, edges) {
  const stats = {
    candidatePairs: 0,
    intersections: 0,
    snapMerges: 0,
    cuts: 0,
    connectorsPlanned: 0,
    connectorsAdded: 0
  };
  if (!edges.length) return stats;

  const connectors = [];

  for (let i = 0; i < edges.length; i++) {
    const e1 = edges[i];
    for (let j = i + 1; j < edges.length; j++) {
      const e2 = edges[j];
      if (e1.featureIndex === e2.featureIndex) continue;
      if (sharesEndpoint(e1, e2)) continue;
      if (!bboxClose(e1, e2, EDGE_CONNECT_TOL_M)) continue;

      stats.candidatePairs++;
      const analysis = segmentProximity(e1, e2);
      if (!analysis) continue;
      if (analysis.distance > EDGE_CONNECT_TOL_M) continue;
      if (analysis.intersection) stats.intersections++;

      const sharedModes = intersectModes(e1.modes, e2.modes);
      if (!sharedModes.size) continue;

      const refA = registerCut(e1, analysis.tA, analysis.coordA, stats);
      const refB = registerCut(e2, analysis.tB, analysis.coordB, stats);

      if (analysis.distance <= SAME_POINT_EPS_M) {
        stats.snapMerges++;
        continue;
      }

      connectors.push({
        aEdgeId: e1.id,
        bEdgeId: e2.id,
        aRef: refA,
        bRef: refB,
        dist: analysis.distance,
        modes: sharedModes
      });
      stats.connectorsPlanned++;
    }
  }

  edges.forEach((edge) => applyEdgeCuts(graph, edge));

  connectors.forEach((conn) => {
    const aId = resolveRef(graph, edges, conn.aEdgeId, conn.aRef);
    const bId = resolveRef(graph, edges, conn.bEdgeId, conn.bRef);
    if (aId == null || bId == null || aId === bId) return;
    if (hasEdge(graph, aId, bId)) return;
    const weight = Number.isFinite(conn.dist)
      ? conn.dist
      : meters(graph.nodes[aId]?.xy || [0, 0], graph.nodes[bId]?.xy || [0, 0]);
    graph.addEdge(aId, bId, weight, { modes: conn.modes });
    stats.connectorsAdded++;
  });

  return stats;
}

function sharesEndpoint(e1, e2) {
  return (
    e1.aId === e2.aId ||
    e1.aId === e2.bId ||
    e1.bId === e2.aId ||
    e1.bId === e2.bId
  );
}

function bboxClose(e1, e2, tol) {
  const min1x = e1.minX - tol;
  const max1x = e1.maxX + tol;
  const min1y = e1.minY - tol;
  const max1y = e1.maxY + tol;
  const min2x = e2.minX - tol;
  const max2x = e2.maxX + tol;
  const min2y = e2.minY - tol;
  const max2y = e2.maxY + tol;

  if (max1x < min2x || max2x < min1x) return false;
  if (max1y < min2y || max2y < min1y) return false;
  return true;
}

function segmentProximity(e1, e2) {
  const intersect = segmentIntersection(e1, e2);
  if (intersect) return intersect;

  let best = null;
  const consider = (distance, tA, tB, coordA, coordB) => {
    if (!Number.isFinite(distance)) return;
    if (!best || distance < best.distance) {
      best = { distance, tA, tB, coordA, coordB };
    }
  };

  const proj1 = projectPointToEdge(e1.projA, e2);
  consider(proj1.dist, 0, proj1.t, e1.a, proj1.coord);

  const proj2 = projectPointToEdge(e1.projB, e2);
  consider(proj2.dist, 1, proj2.t, e1.b, proj2.coord);

  const proj3 = projectPointToEdge(e2.projA, e1);
  consider(proj3.dist, proj3.t, 0, proj3.coord, e2.a);

  const proj4 = projectPointToEdge(e2.projB, e1);
  consider(proj4.dist, proj4.t, 1, proj4.coord, e2.b);

  return best;
}

function segmentIntersection(e1, e2) {
  const ax = e1.projA[0], ay = e1.projA[1];
  const bx = e1.projB[0], by = e1.projB[1];
  const cx = e2.projA[0], cy = e2.projA[1];
  const dx = e2.projB[0], dy = e2.projB[1];

  const rX = bx - ax;
  const rY = by - ay;
  const sX = dx - cx;
  const sY = dy - cy;

  const denom = rX * sY - rY * sX;
  if (Math.abs(denom) < 1e-9) return null;

  const uX = cx - ax;
  const uY = cy - ay;

  const t = (uX * sY - uY * sX) / denom;
  const v = (uX * rY - uY * rX) / denom;
  if (t < 0 || t > 1 || v < 0 || v > 1) return null;

  const tClamped = clamp01(t);
  const vClamped = clamp01(v);

  const coordA = interpolateCoord(e1, tClamped);
  const coordB = interpolateCoord(e2, vClamped);
  const dist = meters(coordA, coordB);

  return { distance: dist, tA: tClamped, tB: vClamped, coordA, coordB, intersection: true };
}

function projectPointToEdge(pointProj, edge) {
  const abX = edge.projB[0] - edge.projA[0];
  const abY = edge.projB[1] - edge.projA[1];
  const lenSq = abX * abX + abY * abY;
  let t = lenSq === 0 ? 0 : ((pointProj[0] - edge.projA[0]) * abX + (pointProj[1] - edge.projA[1]) * abY) / lenSq;
  t = clamp01(t);
  const closest = [
    edge.projA[0] + abX * t,
    edge.projA[1] + abY * t
  ];
  const dx = pointProj[0] - closest[0];
  const dy = pointProj[1] - closest[1];
  const dist = Math.sqrt(dx * dx + dy * dy);
  return { t, coord: interpolateCoord(edge, t), dist };
}

function registerCut(edge, t, coord, stats) {
  const clamped = clamp01(t);
  if (Math.abs(clamped) <= CUT_T_EPS) return { type: "endpoint", nodeId: edge.aId };
  if (Math.abs(1 - clamped) <= CUT_T_EPS) return { type: "endpoint", nodeId: edge.bId };

  const key = `${edge.id}@${roundT(clamped)}`;
  let cut = edge.cuts.get(key);
  if (!cut) {
    cut = { key, t: clamped, coord: coord || interpolateCoord(edge, clamped), nodeId: null };
    edge.cuts.set(key, cut);
    if (stats) stats.cuts++;
  }
  return { type: "cut", edgeId: edge.id, key };
}

function applyEdgeCuts(graph, edge) {
  if (!edge.cuts || edge.cuts.size === 0) return;

  graph.removeEdge(edge.aId, edge.bId);

  const parts = [
    { t: 0, coord: edge.a, nodeId: edge.aId },
    ...Array.from(edge.cuts.values()).map((cut) => ({ t: cut.t, coord: cut.coord, cut })),
    { t: 1, coord: edge.b, nodeId: edge.bId }
  ].sort((a, b) => a.t - b.t);

  parts.forEach((part) => {
    if (!part.nodeId) {
      part.nodeId = graph.getId(part.coord);
      if (part.cut) part.cut.nodeId = part.nodeId;
    } else if (part.cut) {
      part.cut.nodeId = part.nodeId;
    }
  });

  for (let i = 1; i < parts.length; i++) {
    const prev = parts[i - 1];
    const curr = parts[i];
    if (prev.nodeId === curr.nodeId) continue;
    const dist = meters(prev.coord, curr.coord);
    if (!Number.isFinite(dist) || dist < 0.05) continue;
    if (hasEdge(graph, prev.nodeId, curr.nodeId)) continue;
    graph.addEdge(prev.nodeId, curr.nodeId, dist, { modes: edge.modes });
  }
}

function resolveRef(graph, edges, edgeId, ref) {
  if (!ref) return null;
  if (ref.type === "endpoint") return ref.nodeId;
  const edge = edges[edgeId];
  if (!edge) return null;
  const cut = edge.cuts.get(ref.key);
  if (!cut) return null;
  if (cut.nodeId == null) {
    cut.nodeId = graph.getId(cut.coord);
  }
  return cut.nodeId;
}

function hasEdge(graph, aId, bId) {
  return (graph.adj[aId] || []).some((e) => e.to === bId);
}

function intersectModes(setA, setB) {
  const out = new Set();
  if (!setA || !setB) return out;
  setA.forEach((m) => {
    if (setB.has(m)) out.add(m);
  });
  return out;
}

function interpolateCoord(edge, t) {
  const clamped = clamp01(t);
  return [
    edge.a[0] + (edge.b[0] - edge.a[0]) * clamped,
    edge.a[1] + (edge.b[1] - edge.a[1]) * clamped
  ];
}

function clamp01(v) {
  if (v <= 0) return 0;
  if (v >= 1) return 1;
  return v;
}

function roundT(t) {
  return (Math.round(t * 1e6) / 1e6).toFixed(6);
}

// Tüm route çizgileri üzerinde en yakın nokta
function snapToNetworkAllRoutes(routesFC, xy) {
  if (!routesFC) return null;
  const pt = turf.point(xy);
  let best = null;

  (routesFC.features || []).forEach((f, fi) => {
    if (!f.geometry || f.geometry.type !== "LineString") return;
    const res = turf.nearestPointOnLine(f, pt, { units: "meters" });
    const idx = res.properties.index;
    const line = f.geometry.coordinates;
    const a = line[Math.max(0, idx)];
    const b = line[Math.min(line.length - 1, idx + 1)];
    const snap = {
      xy: res.geometry.coordinates,
      a,
      b,
      modes: new Set(
        String(f.properties?.modes || "walk,bike,shuttle")
          .split(/[,\s;]+/)
          .filter(Boolean)
      ),
      distM: res.properties.dist,
      featureIndex: fi,
    };
    if (!best || snap.distM < best.distM) best = snap;
  });

  return best; // {xy, a, b, modes, distM, ...}
}

// A–B kenarını S noktasında ikiye böl → grafı güncelle
function insertTempNodeIntoGraph(graph, snap) {
  const { xy, a, b, modes } = snap;
  const S = graph.getId(xy, /*forceNew*/ true);
  const aId = graph.getId(a);
  const bId = graph.getId(b);

  graph.removeEdge(aId, bId);
  graph.addEdge(aId, S, meters(a, xy), { modes });
  graph.addEdge(S, bId, meters(xy, b), { modes });

  return S;
}

// Mod kısıtlı Dijkstra
function dijkstra(graph, startId, endId, profileKey = "walk") {
  const allowed = new Set([profileKey]);
  const N = graph.nodes.length;
  const distArr = new Array(N).fill(Infinity);
  const prev = new Array(N).fill(-1);
  const used = new Array(N).fill(false);

  distArr[startId] = 0;

  for (let k = 0; k < N; k++) {
    let u = -1, best = Infinity;
    for (let i = 0; i < N; i++) if (!used[i] && distArr[i] < best) { best = distArr[i]; u = i; }
    if (u === -1) break;
    used[u] = true;
    if (u === endId) break;

    for (const e of (graph.adj[u] || [])) {
      if (e.modes && ![...e.modes].some((m) => allowed.has(m))) continue;
      const alt = distArr[u] + e.w;
      if (alt < distArr[e.to]) { distArr[e.to] = alt; prev[e.to] = u; }
    }
  }

  if (prev[endId] === -1 && endId !== startId) return null;

  const path = [];
  let cur = endId;
  while (cur !== -1) { path.push(cur); if (cur === startId) break; cur = prev[cur]; }
  return path.reverse();
}

// ==================== ANA GİRİ�?: computeRoute ====================
/**
 * computeRoute(opts)
 * @param {maplibregl.Map} opts.map
 * @param {FeatureCollection} opts.routesFC
 * @param {[lon,lat]} opts.startXY
 * @param {[lon,lat]} opts.destXY
 * @param {"walk"|"bike"|"shuttle"} opts.profile
 * @param {{walk:number,bike:number,shuttle:number}} opts.speeds (m/sn)
 * @param {{MAX_CONNECTOR_M:number, HIDE_CONNECTOR_LT_M:number}} opts.limits
 *
 * Dönüş (başarılı):
 *   {
 *     coords,                 // ana rota koordinatları
 *     totalLenM, durSec,      // toplam mesafe & süre
 *     graph, Ssnap, Tsnap,    // debug için
 *   }
 * Hata:
 *   { error: "mesaj" }
 */
export function computeRoute(opts) {
  const { map, routesFC, startXY, destXY, profile = "walk", speeds, limits } = opts || {};
  const groupStarted = logGroupStart("computeRoute", { profile, startXY, destXY });
  try {
    if (!routesFC) {
      logWarn("routes.json yüklü değil veya hata verdi");
      return { error: "routes.json yüklü değil" };
    }
    if (!destXY) {
      logWarn("Hedef seçili değil");
      return { error: "Hedef seçili değil" };
    }

    // 1) Graf (her çağrıda kurmak basit; istersen cache’leyebilirsin)
    const graph = buildRouteGraph(routesFC);
    if (typeof window !== "undefined") window.__GRAPH = graph;
    logDebug("graph ready", {
      nodeCount: graph.nodes.length,
      edgeCount: Object.values(graph.adj).reduce((sum, l) => sum + (l?.length || 0), 0) / 2
    });

    // 2) Snap
    const Ssnap = snapToNetworkAllRoutes(routesFC, startXY);
    const Tsnap = snapToNetworkAllRoutes(routesFC, destXY);
    logDebug("snap results", {
      start: Ssnap ? { dist: Ssnap.distM, featureIndex: Ssnap.featureIndex, xy: Ssnap.xy } : null,
      dest: Tsnap ? { dist: Tsnap.distM, featureIndex: Tsnap.featureIndex, xy: Tsnap.xy } : null
    });
    if (!Ssnap || !Tsnap) {
      logWarn("Snap başarısız", { hasStartSnap: !!Ssnap, hasDestSnap: !!Tsnap });
      return { error: "Ağa snap edilemedi." };
    }

    // 3) Connector mesafeleri
    const MAX_CONNECTOR_M = limits?.MAX_CONNECTOR_M ?? 50;
    const HIDE_CONNECTOR_LT_M = limits?.HIDE_CONNECTOR_LT_M ?? 5;
    const startConnM = startXY ? meters(startXY, Ssnap.xy) : 0;
    const destConnM  = destXY  ? meters(Tsnap.xy,  destXY) : 0;
    logDebug("connector distances", { startConnM, destConnM, MAX_CONNECTOR_M, HIDE_CONNECTOR_LT_M });

    if (startConnM > MAX_CONNECTOR_M || destConnM > MAX_CONNECTOR_M) {
      logWarn("Başlangıç veya hedef ağdan çok uzakta", { startConnM, destConnM, MAX_CONNECTOR_M });
      return { error: "Başlangıç veya hedef yol ağından çok uzakta." };
    }

    // 4) Geçici düğümler
    const Sid = insertTempNodeIntoGraph(graph, Ssnap);
    const Tid = insertTempNodeIntoGraph(graph, Tsnap);
    logDebug("temporary nodes", {
      Sid,
      Tid,
      startDegree: (graph.adj[Sid] || []).length,
      destDegree: (graph.adj[Tid] || []).length
    });

    // 5) Dijkstra
    const nodePath = dijkstra(graph, Sid, Tid, profile);
    if (!nodePath) {
      const reach = reachabilityFrom(graph, Sid, /*limit*/ 2000);
      logWarn("Uygun rota bulunamadı (ağ kopuk/mod kısıtı)", {
        startId: Sid,
        destId: Tid,
        startDegree: (graph.adj[Sid] || []).length,
        destDegree: (graph.adj[Tid] || []).length,
        reachableNodes: reach.size,
        destReachable: reach.has(Tid),
        profile
      });
      if (typeof window !== "undefined") {
        window.__ROUTE_LAST = { graph, Ssnap, Tsnap, Sid, Tid, startConnM, destConnM, nodePath: null };
      }
      return { error: "Uygun rota bulunamadı (ağ kopuk/mod kısıtı)." };
    }

    // 6) GeoJSON çiz
    const nodeCoords = nodePath.map((id) => graph.nodes[id].xy);
    const features = [
      { type: "Feature", properties: { role: "main" }, geometry: { type: "LineString", coordinates: nodeCoords } },
    ];
    if (startXY && startConnM >= HIDE_CONNECTOR_LT_M) {
      features.push({ type: "Feature", properties: { role: "connector" }, geometry: { type: "LineString", coordinates: [startXY, Ssnap.xy] } });
    }
    if (destXY && destConnM >= HIDE_CONNECTOR_LT_M) {
      features.push({ type: "Feature", properties: { role: "connector" }, geometry: { type: "LineString", coordinates: [Tsnap.xy, destXY] } });
    }
    map.getSource("route")?.setData({ type: "FeatureCollection", features });

    // 7) Mesafe & süre
    const mainLenM = totalLength(nodeCoords);
    const totalLenM = mainLenM + (startXY ? meters(startXY, Ssnap.xy) : 0) + (destXY ? meters(Tsnap.xy, destXY) : 0);
    const sp = speeds?.[profile] || speeds?.walk || 1.35; // m/sn
    const durSec = mainLenM / sp;
    logInfo("route computed", {
      nodeCount: nodePath.length,
      mainLenM,
      totalLenM,
      durationSec: durSec,
      profile
    });

    // 8) Haritayı kadraja al
    const all = [...nodeCoords, ...(startXY ? [startXY] : []), ...(destXY ? [destXY] : [])];
    const bb = bboxFromCoords(all);
    if (bb) map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: { top:120, right:16, bottom:160, left:16 }, maxZoom: 25 });

    if (typeof window !== "undefined") {
      window.__ROUTE_LAST = { graph, Ssnap, Tsnap, Sid, Tid, startConnM, destConnM, nodePath, profile };
    }

    return { coords: nodeCoords, totalLenM, durSec, graph, Ssnap, Tsnap };
  } catch (err) {
    logWarn("computeRoute hata:", err?.message || err);
    return { error: "Rota hesaplanırken hata oluştu." };
  } finally {
    logGroupEnd(groupStarted);
  }
}

// bbox hesap
function bboxFromCoords(coords) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  coords.forEach(([x, y]) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  });
  return (isFinite(minX) && isFinite(minY) && isFinite(maxX) && isFinite(maxY)) ? [minX, minY, maxX, maxY] : null;
}
