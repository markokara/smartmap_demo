/**
 * src/map/simulation.js
 * Kullanıcı konum simülasyonu (STATELESS)
 * Bu modül, animasyon döngüsünü yönetir ve her karede yeni koordinatları bir callback aracılığıyla bildirir.
 * Durum (state) ve harita marker'ı yönetimi bu modülün dışındadır.
 */

let simulationTimer = null;

/**
 * Belirtilen bir rota (LineString) üzerinde simülasyon başlatır.
 * @param {object} map - MapLibre harita örneği.
 * @param {object} route - GeoJSON FeatureCollection formatında rota.
 * @param {function} onUpdate - Her animasyon karesinde `(coords)` ile çağrılacak callback.
 */
export function startRouteSimulation(map, route, onUpdate) {
  if (simulationTimer) stopSimulation();

  const line = route.features.find(f => f.geometry.type === 'LineString');
  if (!line) {
    console.error("No LineString feature found in the route data.");
    return;
  }

  const duration = 30000; // 30 saniye
  let startTime = performance.now();

  function animate(timestamp) {
    const elapsed = timestamp - startTime;
    const t = Math.min(elapsed / duration, 1);
    const point = turf.along(line, t * turf.length(line)).geometry.coordinates;

    onUpdate(point);

    if (t < 1) {
      simulationTimer = requestAnimationFrame(animate);
    } else {
      simulationTimer = null; // Simülasyon bitti
    }
  }

  simulationTimer = requestAnimationFrame(animate);
}

/**
 * Harita merkezi etrafında dairesel bir demo simülasyonu başlatır.
 * @param {object} map - MapLibre harita örneği.
 * @param {function} onUpdate - Her animasyon karesinde `(coords)` ile çağrılacak callback.
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
    const t = (elapsed % duration) / duration; // Döngüyü tekrarla

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
