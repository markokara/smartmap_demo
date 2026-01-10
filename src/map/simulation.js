/**
 * src/map/simulation.js
 * Kullanıcı konum simülasyonu (STATELESS)
 * Animasyon döngüsünü yönetir, her karede yeni koordinatı callback ile bildirir.
 */

let simulationTimer = null;

/**
 * Rota üzerinde simülasyon başlatır.
 * @param {object} map - MapLibre örneği.
 * @param {object} route - GeoJSON FeatureCollection (computeRoute sonucu).
 * @param {function} onUpdate - Her karede `(coords)` ile çağrılır.
 * @param {object} opts - { durationMs?: number, onFinish?: function }
 */
export function startRouteSimulation(map, route, onUpdate, opts = {}) {
  if (simulationTimer) stopSimulation();

  const line =
    route.features.find((f) => f.geometry?.type === "LineString" && (f.properties?.role ?? "main") === "main") ||
    route.features.find((f) => f.geometry?.type === "LineString");
  if (!line) {
    console.error("No LineString feature found in the route data.");
    return;
  }

  const duration = Math.max(2000, opts.durationMs ?? 8000); // varsayılan: 8 sn
  let startTime = performance.now();
  const totalLen = turf.length(line, { units: "kilometers" });

  function animate(timestamp) {
    const elapsed = timestamp - startTime;
    const t = Math.min(elapsed / duration, 1);
    const point = turf.along(line, t * totalLen, { units: "kilometers" }).geometry.coordinates;

    onUpdate(point);

    if (t < 1) {
      simulationTimer = requestAnimationFrame(animate);
    } else {
      simulationTimer = null; // Simülasyon bitti
      if (typeof opts.onFinish === "function") opts.onFinish();
    }
  }

  simulationTimer = requestAnimationFrame(animate);
}

/**
 * Harita merkezi etrafında dairesel demo simülasyonu başlatır.
 * @param {object} map - MapLibre örneği.
 * @param {function} onUpdate - Her karede `(coords)` ile çağrılır.
 */
export function startUserSimulation(map, onUpdate) {
  if (simulationTimer) stopSimulation();

  const cfg = map.__SIM_USER_CFG || {};
  const center = cfg.center || map.getCenter();
  const radius = cfg.radiusKm || 0.03; // km
  const duration = cfg.loopDurationMs || 20000; // 20 saniye
  let startTime = performance.now();

  const circlePoly = turf.circle(center, radius, { steps: 128, units: "kilometers" });
  const circleLine = turf.polygonToLine(circlePoly);
  const circleLen = turf.length(circleLine, { units: "kilometers" }) || 1;

  function animate(timestamp) {
    const elapsed = timestamp - startTime;
    const t = (elapsed % duration) / duration; // Döngü tekrarı

    const point = turf.along(circleLine, t * circleLen, { units: "kilometers" }).geometry.coordinates;
    onUpdate(point);

    simulationTimer = requestAnimationFrame(animate);
  }

  simulationTimer = requestAnimationFrame(animate);
}

export function stopSimulation() {
  if (simulationTimer) {
    cancelAnimationFrame(simulationTimer);
    simulationTimer = null;
  }
}
