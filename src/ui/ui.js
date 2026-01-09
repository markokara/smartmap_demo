/**
 * src/ui/ui.js
 * Misafir-dostu panel ve arama/rota UI (2 durak: Açık/Kapalı).
 * Kapalı: panel tamamen ekran altında; sadece dış grab (#grabDock) görünür.
 */

import { CONFIG } from "../config.js";
import { tt, norm } from "../i18n.js";
import { detectCategory, applyPoiCategoryFilter, CAT_COLORS, SYNONYMS, ICONS } from "../categories.js";

const FALLBACK_LANGS = ["en", "tr"];
let activePopup = null;

function getActiveLang() {
  return (localStorage.getItem("lang") || "en").toLowerCase();
}

function pickLocalized(props, baseKey, lang = getActiveLang()) {
  if (!props || !baseKey) return "";
  const direct = props[`${baseKey}_${lang}`];
  if (direct != null && String(direct).trim() !== "") return direct;
  if (props[baseKey] != null && String(props[baseKey]).trim() !== "") return props[baseKey];
  for (const fb of FALLBACK_LANGS) {
    const alt = props[`${baseKey}_${fb}`];
    if (alt != null && String(alt).trim() !== "") return alt;
  }
  return "";
}

/* ============================================================
 * K A M U S A L   A P I
 * ==========================================================*/
export function setupUIBindings({ map, state, onRoute, onProfileChange }) {
  const $ = (id)=> document.getElementById(id);

  // Seçiciler
  const q            = $("q");
  const pickStartBtn = $("pickStart");   // HTML'de olmayabilir
  const pickDestBtn  = $("pickDest");
  const goBtn        = $("go");
  const followBtn    = $("follow");
  const resetBtn     = $("reset");
  const results      = $("results");
  const clearSearchBtn = $("clearSearch");

  const dirBox       = $("dirBox");
  const dirSum       = $("dirSum");
  const clearRoute   = $("clearRoute");

  const controlShell = document.querySelector(".control-shell");
  const allFeatures = state.data?.allFeats || [];
  const categoryStats = buildCategoryStats(allFeatures);
  const lastSearch = { query: "", results: [], activeCategoryKey: null };
  const updateFollowLabel = () => {
    if (!followBtn) return;
    const key = state.followOn ? "ui.followOn" : "ui.followOff";
    followBtn.textContent = tt(key, getActiveLang());
  };
  const dispatchSheet = (type) => window.dispatchEvent(new CustomEvent(`app:sheet-${type}`));
  const openSheet = () => dispatchSheet("open");
  const closeSheet = () => dispatchSheet("close");

  // Mod (search | route)
  function setMode(mode){
    const isRoute = mode === 'route';
    if (controlShell) controlShell.style.display = isRoute ? 'none' : 'flex';
    if (dirBox)    dirBox.style.display    = isRoute ? 'flex' : 'none';
  }
  setMode('search');

  function startNavigation(center, opts = {}) {
    if (!center) return;
    const xy = Array.isArray(center)
      ? center
      : (center?.lng != null && center?.lat != null ? [center.lng, center.lat] : null);
    if (!xy) return;
    state.destCoord = xy;
    setSource(map, "dest", fcPoint(xy));
    state.pickMode = "none";
    updateGoEnabled();
    setMode('route');
    if (!opts?.keepSheetClosed) openSheet();
    if (typeof onRoute === "function") onRoute();
  }

  function clearCategorySelection(hideResults = false){
    applyPoiCategoryFilter(map, null);
    lastSearch.activeCategoryKey = null;
    if (q) q.value = "";
    if (clearSearchBtn) clearSearchBtn.hidden = true;
    lastSearch.query = "";
    lastSearch.results = [];
    if (results) {
      if (hideResults) {
        results.innerHTML = "";
        results.style.display = "none";
      } else {
        results.style.display = "block";
      }
    }
  }

  function handleCategorySelect(cat){
    if (!cat) return;
    const lang = getActiveLang();
    const label = tt("cats." + cat.key, lang) || cat.label || cat.key;
    applyPoiCategoryFilter(map, cat.key);
    const feats = allFeatures.filter(f => (f?.properties?.category || "") === cat.key);
    if (q) q.value = label;
    if (clearSearchBtn) clearSearchBtn.hidden = false;
    lastSearch.query = label;
    lastSearch.results = feats;
    lastSearch.activeCategoryKey = cat.key;
    const enrichedCat = {
      ...cat,
      label,
      color: cat.color || CAT_COLORS?.[cat.key] || CAT_COLORS?.default || "#2563eb"
    };
    renderResults(results, feats, map, state, label, lang, startNavigation, [], {
      activeCategory: enrichedCat,
      onClearCategory: () => {
        clearCategorySelection(true);
        if (state.pickMode === "dest") showAllCategories();
      }
    });
  }

  function showAllCategories(){
    const lang = getActiveLang();
    const suggestions = matchCategories("", categoryStats, lang);
    lastSearch.query = "";
    lastSearch.results = [];
    lastSearch.activeCategoryKey = null;
    if (q) q.value = "";
    if (clearSearchBtn) clearSearchBtn.hidden = true;
    renderResults(results, [], map, state, "", lang, startNavigation, suggestions, {
      onCategorySelect: handleCategorySelect,
      showCategoriesOnly: true
    });
    if (results) results.style.display = "block";
  }

  // Başlangıç butonu (opsiyonel)
  if (pickStartBtn && CONFIG.START_POLICY?.showPickStartButton === false) {
    pickStartBtn.style.display = "none";
  } else if (pickStartBtn) {
    pickStartBtn.addEventListener("click", ()=>{
      state.pickMode = (state.pickMode === "start") ? "none" : "start";
      tip("Haritadan başlangıç noktasına dokunun.");
    });
  }

  // Hedef seç
  pickDestBtn?.addEventListener("click", ()=>{
    const activating = state.pickMode !== "dest";
    state.pickMode = activating ? "dest" : "none";
    if (state.pickMode === "dest") {
      tip("Haritadan hedefe dokunun veya kategori seçin.");
      showAllCategories();
      openSheet();
    } else {
      clearCategorySelection(true);
      if (!lastSearch.query && !state.destCoord && results) results.style.display = "none";
    }
    updateGoEnabled();
  });

  // Git → rota hesapla + rota modu
  goBtn?.addEventListener("click", ()=>{
    if (!state.destCoord) return;
    startNavigation(state.destCoord, { keepSheetClosed: false });
  });

  // GO etkinlik koşulu
  function updateGoEnabled(){ if (goBtn) goBtn.disabled = !state.destCoord; }

  // Follow toggle
  followBtn?.addEventListener("click", ()=>{
    state.followOn = !state.followOn;
    updateFollowLabel();
    if (state.followOn && state.lastKnown) map.easeTo({ center: state.lastKnown });
  });
  updateFollowLabel();

  // Reset
  resetBtn?.addEventListener("click", ()=>{
    setSource(map, "route", emptyFC());
    setSource(map, "dest", emptyFC());
    setSource(map, "start", emptyFC());
    state.destCoord = null;
    state.startCoord = null;
    if (dirSum) dirSum.textContent = "";
    clearCategorySelection(true);
    updateGoEnabled();
    setMode('search');
    openSheet();
  });

  // Rota temizle
  clearRoute?.addEventListener("click", ()=>{
    setSource(map, "route", emptyFC());
    if (dirSum) dirSum.textContent = "";
    setMode('search');
    openSheet();
  });

  // Arama
  q?.addEventListener("focus", () => openSheet());
  q?.addEventListener("input", ()=>{
    const val = (q.value || "").trim();
    if (clearSearchBtn) clearSearchBtn.hidden = !val;
    if (!val) {
      clearCategorySelection(state.pickMode !== "dest");
      if (state.pickMode === "dest") {
        showAllCategories();
      }
      return;
    }
    const lang = getActiveLang();
    const hits = simpleSearch(val, allFeatures, map, val);
    const catMatches = matchCategories(val, categoryStats, lang);
    lastSearch.query = val;
    lastSearch.results = hits;
    lastSearch.activeCategoryKey = null;
    renderResults(results, hits, map, state, val, lang, startNavigation, catMatches, {
      onCategorySelect: handleCategorySelect
    });
  });

  clearSearchBtn?.addEventListener("click", ()=>{
    if (!q) return;
    q.value = "";
    clearCategorySelection(state.pickMode !== "dest");
    if (state.pickMode === "dest") {
      showAllCategories();
    } else if (results) {
      results.innerHTML = "";
      results.style.display = "none";
    }
  });

  window.addEventListener("app:lang-changed", (ev)=>{
    const lang = ev?.detail?.lang || getActiveLang();
    updateFollowLabel();
    if (activePopup) {
      activePopup.remove();
      activePopup = null;
    }
    if (lastSearch.activeCategoryKey) {
      const cat = categoryStats.find(c => c.key === lastSearch.activeCategoryKey);
      if (cat) {
        const label = tt("cats." + cat.key, lang) || cat.key;
        const feats = allFeatures.filter(f => (f?.properties?.category || "") === cat.key);
        lastSearch.query = label;
        lastSearch.results = feats;
        if (q) q.value = label;
        if (clearSearchBtn) clearSearchBtn.hidden = !label;
        const enrichedCat = {
          ...cat,
          label,
          color: CAT_COLORS?.[cat.key] || CAT_COLORS?.default || "#2563eb"
        };
        renderResults(results, feats, map, state, label, lang, startNavigation, [], {
          activeCategory: enrichedCat,
          onClearCategory: clearCategorySelection
        });
        return;
      }
    }
    if (!lastSearch.query) {
      if (state.pickMode === "dest") {
        showAllCategories();
      } else if (results) {
        results.style.display = "none";
      }
      if (clearSearchBtn) clearSearchBtn.hidden = true;
      return;
    }
    const catMatches = matchCategories(lastSearch.query, categoryStats, lang);
    renderResults(results, lastSearch.results, map, state, lastSearch.query, lang, startNavigation, catMatches, {
      onCategorySelect: handleCategorySelect
    });
    if (clearSearchBtn) clearSearchBtn.hidden = !lastSearch.query;
  });

  // Harita tıklaması
  map.on("click", (e)=>{
    if (state.pickMode === "dest") {
      state.destCoord = [e.lngLat.lng, e.lngLat.lat];
      setSource(map, "dest", fcPoint(state.destCoord));
      state.pickMode = "none";
      if (results) results.style.display = "none";
      updateGoEnabled(); return;
    }
    if (state.pickMode === "start") {
      state.startCoord = [e.lngLat.lng, e.lngLat.lat];
      setSource(map, "start", fcPoint(state.startCoord));
      state.pickMode = "none"; updateGoEnabled(); return;
    }

    // normal tık → popup
    const feats = map.queryRenderedFeatures(e.point, {
      layers: ['indoor-pts','outdoor-pts','indoor-fill','outdoor-fill','indoor-line','outdoor-line','indoor-fill-outline','outdoor-fill-outline']
    });
    if (feats && feats[0]) {
      const f = feats[0];
      const center = coordOfFeature(f);
      showPopup(map, f, center, ()=> startNavigation(center));
    }
  });

  // Profil (varsa)
  document.querySelectorAll('input[name="profile"]').forEach(r=>{
    r.addEventListener('change', ()=> onProfileChange && onProfileChange(r.value));
  });

  // helpers
  function setSource(map, id, data){ map.getSource(id)?.setData(data); }
  function tip(msg){
    const acc = document.getElementById("acc"); if (!acc) return;
    acc.textContent = msg; acc.style.display = "block";
    setTimeout(()=>{ acc.style.display="none"; }, 2000);
  }
}

/* ============================================================
 * Arama + sonuç render
 * ==========================================================*/
function simpleSearch(query, allFeats, map, raw) {
  const nq  = norm(query);
  const lang = getActiveLang();
  const cat = detectCategory(query, lang);
  applyPoiCategoryFilter(map, cat || null);

  const hits = allFeats.filter(f=>{
    const p = f.properties || {};
    const catKey = String(p.category || "").toLowerCase();
    if (cat && catKey === cat) return true;

    const names = [p.name, p.name_tr, p.name_en, p.name_ru, p.name_de, p.name_pl]
      .filter(Boolean).map(norm);
    if (names.some(n=>n.includes(nq))) return true;

    const extra = [
      p.desc, p['desc_tr'], p['desc_en'], p['desc_ru'], p['desc_de'], p['desc_pl'],
      p.level, p['level_tr'], p['level_en'], p['level_ru'], p['level_de'], p['level_pl'],
      p.hours, p['hours_tr'], p['hours_en'], p['hours_ru'], p['hours_de'], p['hours_pl']
    ].filter(Boolean).map(norm);
    return extra.some(d=>d.includes(nq));
  });

  return hits.slice(0, 80);
}

function highlight(text, q){
  if (!q) return text;
  const re = new RegExp(`(${escapeRegExp(q)})`,'ig');
  return String(text).replace(re,'<mark>$1</mark>');
}
function escapeRegExp(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function buildCategoryGradient(hex){

  const base = (hex || "#2563eb").trim();

  const light = mixHex(base, 0.28);

  const dark = mixHex(base, -0.2);

  return `linear-gradient(135deg, ${light} 0%, ${dark} 100%)`;

}



function mixHex(hex, amount){
  if (typeof hex !== "string" || !/^#?[0-9a-f]{3,6}$/i.test(hex)) return hex || "#2563eb";
  let color = hex.replace("#", "");
  if (color.length === 3) color = color.split("").map(c => c + c).join("");
  const amt = Math.max(-1, Math.min(1, amount || 0));
  const num = parseInt(color, 16);
  let r = (num >> 16) & 255;
  let g = (num >> 8) & 255;
  let b = num & 255;
  const target = amt < 0 ? 0 : 255;
  const t = Math.abs(amt);
  r = Math.round(r + (target - r) * t);
  g = Math.round(g + (target - g) * t);
  b = Math.round(b + (target - b) * t);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function renderResults(resultsEl, list, map, state, rawQ, lang = getActiveLang(), startNav, catMatches = [], options = {}){

  if (!resultsEl) return;

  resultsEl.innerHTML = "";
  resultsEl.scrollTop = 0;

  const frag = document.createDocumentFragment();



  if (options.activeCategory) {

    const info = document.createElement("div");

    info.className = "hint";

    info.style.display = "flex";

    info.style.alignItems = "center";

    info.style.justifyContent = "space-between";

    const countLabel = options.activeCategory.count ?? list.length;

    info.innerHTML = `<span><strong>${options.activeCategory.label}</strong> (${countLabel})</span>`;

    if (typeof options.onClearCategory === "function") {

      const btn = document.createElement("button");

      btn.type = "button";

      btn.textContent = tt("ui.reset", lang) || "Reset";

      btn.style.cssText = "margin-left:12px;border-radius:999px;border:1px solid var(--border);background:#fff;color:#0f5132;font-size:12px;padding:4px 10px;cursor:pointer;";

      btn.addEventListener("click", options.onClearCategory);

      info.appendChild(btn);

    }

    frag.appendChild(info);

  }



  if (catMatches?.length) {

    const wrap = document.createElement("div");

    wrap.className = "category-suggestions";

    catMatches.forEach(cat=>{

      const btn = document.createElement("button");

      btn.type = "button";

      btn.className = "category-suggestion";

      const baseColor = cat.color || CAT_COLORS?.[cat.key] || CAT_COLORS?.default || "#2563eb";

      btn.style.setProperty("--bg", buildCategoryGradient(baseColor));

      btn.style.setProperty("--cat-bg", baseColor);

      btn.style.setProperty("--cat-bg-soft", mixHex(baseColor, 0.35));

      btn.dataset.category = cat.key;

      const plainLabel = cat.label || tt("cats." + cat.key, lang) || cat.key;

      let remainder = plainLabel;

      if (rawQ) {

        const idx = plainLabel.toLowerCase().indexOf(rawQ.toLowerCase());

        if (idx >= 0) remainder = plainLabel.slice(idx + rawQ.length).trim();

      }

      if (!rawQ || !remainder) remainder = cat.key.replace(/[_-]/g, " ");

      const subtitle = highlight(remainder, rawQ);

      const iconName = cat.icon || ICONS?.[cat.key];

      const thumb = iconName

        ? `<div class="thumb"><img src="./assets/icons/${iconName}" alt=""/></div>`

        : `<div class="thumb"><span>${(plainLabel || cat.key || "?").charAt(0).toUpperCase()}</span></div>`;

      btn.innerHTML = `<div class="body">${thumb}<span class="label"><span class="title">${highlight(plainLabel, rawQ)}</span><small>${subtitle}</small></span><span class="count"><span class="value">${cat.count}</span><span class="chevron">&rsaquo;</span></span></div>`;

      btn.addEventListener("click", ()=> options.onCategorySelect && options.onCategorySelect(cat, { lang }));

      wrap.appendChild(btn);

    });

    frag.appendChild(wrap);

  }



  if (!list.length && !(catMatches?.length)) {

    const hint = document.createElement("div");

    hint.className = "hint";

    hint.textContent = "Sonuc bulunamadi";

    frag.appendChild(hint);

  } else {

    list.forEach((f)=>{

      const p = f.properties || {};

      const name = pickLocalized(p, "name", lang) || "(isimsiz)";

      const level = pickLocalized(p, "level", lang);

      const catKey = p.category || "";

      const catLabel = catKey ? tt("cats." + catKey, lang) : "";

      const catColor = CAT_COLORS?.[catKey] || CAT_COLORS?.default || "#0EA5E9";

      const metaParts = [];

      if (catLabel) metaParts.push(`<span class="meta-pill"><span class="cat-dot" style="--dot:${catColor}"></span>${highlight(catLabel, rawQ)}</span>`);

      if (level) metaParts.push(`<span class="meta-note">${highlight(level, rawQ)}</span>`);

      const metaHtml = metaParts.join("");



      const div = document.createElement("div");

      div.className = "item";

      const metaBlock = metaParts.length ? `<small class="item-meta">${metaHtml}</small>` : "";

      div.innerHTML = `<span class="item-title">${highlight(name, rawQ)}</span>` + (metaBlock ? `
                       ${metaBlock}` : "");

      div.addEventListener("click", ()=>{

        const center = coordOfFeature(f);

        if (typeof startNav === "function") startNav(center, { keepSheetClosed: false });

        showPopup(map, f, center, ()=> startNav && startNav(center, { keepSheetClosed: false }));

        resultsEl.style.display = "none";

      });

      frag.appendChild(div);

    });

  }

  resultsEl.appendChild(frag);

  resultsEl.style.display = "block";

}

function buildCategoryStats(allFeats){
  const statsMap = new Map();
  (allFeats || []).forEach(f=>{
    const cat = (f?.properties?.category || "").trim();
    if (!cat) return;
    if (!statsMap.has(cat)) statsMap.set(cat, { key: cat, count: 0, icon: ICONS?.[cat] || null });
    const stat = statsMap.get(cat);
    stat.count += 1;
  });
  return Array.from(statsMap.values())
    .map(stat => ({
      ...stat,
      icon: stat.icon || ICONS?.[stat.key] || null
    }))
    .sort((a,b)=> a.key.localeCompare(b.key));
}

function matchCategories(query, stats, lang){
  if (!stats || !stats.length) return [];
  const nq = norm(query || "");
  const directCat = detectCategory(query, lang);
  const matches = stats.filter(stat=>{
    if (!query) return true;
    const label = tt("cats." + stat.key, lang) || stat.key;
    if (norm(label).includes(nq)) return true;
    if (stat.key.toLowerCase().includes(nq)) return true;
    if (directCat && stat.key === directCat) return true;
    const syns = (SYNONYMS?.[stat.key] || []).map(norm);
    if (syns.some(s => s.includes(nq) || nq.includes(s))) return true;
    return false;
  });
  if (!matches.length && directCat) {
    const direct = stats.find(s => s.key === directCat);
    if (direct) matches.push(direct);
  }
  matches.sort((a,b)=> (b.count - a.count) || a.key.localeCompare(b.key));
  return matches.slice(0, 8).map(stat => ({
    ...stat,
    label: tt("cats." + stat.key, lang) || stat.key,
    color: CAT_COLORS?.[stat.key] || CAT_COLORS?.default || "#2563eb",
    icon : stat.icon || ICONS?.[stat.key] || null
  }));
}

function showPopup(map, f, lngLat, onGo){
  const lang = getActiveLang();
  const props = f.properties || {};
  const name = pickLocalized(props, "name", lang) || "(isimsiz)";
  const hours = pickLocalized(props, "hours", lang);
  const level = pickLocalized(props, "level", lang);
  const desc = pickLocalized(props, "desc", lang);
  const img = props.image || props.photo || props.img;
  const catLabel = props.category ? (tt("cats." + props.category, lang) || props.category) : "";

  const btn = '<div style="margin-top:8px">\n' +
    '    <button id="__goto" style="padding:8px 10px;border:1px solid #cfe3da;border-radius:10px;background:#f4fbf7">' +
    (tt("go", lang) || "Go") + ' &rarr;</button>\n' +
    '  </div>';

  const html = `<div style="min-width:220px">
    <div style="font-weight:600;margin-bottom:6px;color:#0f5132">${name}</div>
    ${catLabel ? `<div style="display:inline-block;padding:.2rem .5rem;border:1px solid #cfe3da;border-radius:999px;background:#edf7f3;font-size:12px">${catLabel}</div>` : ""}
    ${hours ? `<div style="margin-top:6px"><small>${tt("labels.hours", lang)}:</small> ${hours}</div>` : ""}
    ${level ? `<div><small>${tt("labels.level", lang)}:</small> ${level}</div>` : ""}
    ${desc ? `<div style="margin-top:6px;color:#5b6a6a">${linkify(desc)}</div>` : ""}
    ${/^https?:\/\//i.test(img) ? `<div style="margin-top:6px"><img style="width:100%;max-height:140px;object-fit:cover;border-radius:8px" src="${img}"></div>` : ""}
    ${btn}
  </div>`;

  if (activePopup) activePopup.remove();

  const popup = new maplibregl.Popup({ closeButton:true, closeOnClick:true })
    .setLngLat(Array.isArray(lngLat)? lngLat : [lngLat.lng, lngLat.lat])
    .setHTML(html)
    .addTo(map);
  activePopup = popup;
  popup.on("close", ()=>{ if (activePopup === popup) activePopup = null; });

  setTimeout(()=>{
    const b = document.getElementById("__goto");
    b?.addEventListener("click", ()=>{
      onGo && onGo();
      popup.remove();
      if (activePopup === popup) activePopup = null;
    });
  }, 0);
}

function linkify(text){
  return (text||"").replace(/(https?:\/\/[^\s<>"']+)/g,'<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}
function fcPoint(xy){ return {type:"FeatureCollection",features:[{type:"Feature",geometry:{type:"Point",coordinates:xy}}]}; }
function emptyFC(){ return {type:"FeatureCollection",features:[]}; }
function coordOfFeature(f){
  const g=f.geometry; if(!g) return [0,0];
  if(g.type==='Point') return g.coordinates;
  if(g.type==='Polygon'){ const ring=g.coordinates[0]; return ring[Math.floor(ring.length/2)]; }
  if(g.type==='LineString'){ const c=g.coordinates; return c[Math.floor(c.length/2)]; }
  return [0,0];
}

export function initBottomSheet() {
  const sheet    = document.getElementById("sheet");
  const grabIn   = document.getElementById("grab");      // panel içi küçük grab (açıkken)
  const grabDock = document.getElementById("grabDock");  // panel dışındaki iki çizgi
  const backdrop = document.getElementById("backdrop");
  if (!sheet || !grabDock) return;

  const isOpen = () => sheet.classList.contains("is-open");
  const openSheet = () => {
    sheet.classList.add("is-open");
    backdrop?.classList.add("show");
    grabDock?.classList.add("hidden");
    lockBodyScroll(true);
  };
  const closeSheet = () => {
    sheet.classList.remove("is-open");
    backdrop?.classList.remove("show");
    grabDock?.classList.remove("hidden");
    lockBodyScroll(false);
  };
  const toggleSheet = () => (isOpen() ? closeSheet() : openSheet());

  window.addEventListener("app:sheet-open", openSheet);
  window.addEventListener("app:sheet-close", closeSheet);

  requestAnimationFrame(()=> closeSheet());

  grabDock.addEventListener("click", ()=>{ openSheet(); haptic(10); });
  grabIn?.addEventListener("click", ()=>{ closeSheet(); haptic(8); });
  backdrop?.addEventListener("click", ()=>{ closeSheet(); haptic(8); });

  let sy = null;
  let moved = false;
  let dragging = false;
  const CLICK_TOL = 8;
  const VEL_TH = 0.5;
  let last = [];

  function record(y){
    const t = performance.now();
    last.push({ y, t });
    if (last.length > 8) last.shift();
  }

  grabDock.addEventListener("pointerdown", e=>{
    sy = e.clientY;
    moved = false;
    dragging = true;
    last = [];
    record(e.clientY);
    grabDock.setPointerCapture?.(e.pointerId);
  });
  grabDock.addEventListener("pointermove", e=>{
    if (!dragging || sy == null) return;
    const dy = e.clientY - sy;
    if (Math.abs(dy) > CLICK_TOL) moved = true;
    record(e.clientY);
  });

  function endDrag(e){
    if (!dragging) return;
    dragging = false;
    record(e?.clientY ?? last.at(-1)?.y ?? 0);
    if(last.length>=2){
      const a=last[0], b=last[last.length-1];
      const v=(b.y-a.y)/Math.max(1,b.t-a.t);
      if(Math.abs(v)>VEL_TH){ v<0 ? openSheet() : closeSheet(); sy=null; return; }
    }
    const dy = (last.at(-1)?.y ?? 0) - (last[0]?.y ?? 0);
    if (Math.abs(dy) <= 12 && !moved){
      toggleSheet();
    } else {
      dy < 0 ? openSheet() : closeSheet();
    }
    sy = null;
  }
  grabDock.addEventListener("pointerup", endDrag);
  grabDock.addEventListener("pointercancel", endDrag);

  function haptic(ms){ try{ navigator.vibrate?.(ms); }catch{} }
  function lockBodyScroll(on){
    try{ document.documentElement.style.overflow = on ? "hidden" : ""; }catch{}
  }

  setTimeout(()=>{ if(!isOpen()) openSheet(); }, 350);

  // Geliştiriciye manuel kontrol imkânı (debug)
  window.__sheet = { open: openSheet, close: closeSheet, toggle: toggleSheet };
}

