/**
 * src/categories.js
 * ============================================================
 * POI kategorileriyle ilgili sabitler ve arama yardımcıları:
 * - CAT_COLORS : kategori → rozet rengi (haritada point badge)
 * - ICONS      : kategori → ikon id/asset adı
 * - SYNONYMS   : serbest metin eşanlamlılar (çok dilli kelime varyantları)
 * - detectCategory(q, lang): arama teriminden kategori çıkarır
 *
 * Not:
 * - Dil adlarının (örn "Restoran", "Kawiarnia") i18n sözlüğünde
 *   (I18N[lang].cats) tutulması, burada ise “serbest kelime yakalama”
 *   için eşanlamlıların (SYNONYMS) bulunması en pratik ve stabil düzen.
 */

import { I18N, SUP_LANGS, norm } from "./i18n.js";

/* ------------------------------------------------------------
 * 1) KATEGORİ → RENK (harita rozetleri)
 *   - MapLibre circle katmanında badge rengi için kullanılıyor.
 *   - Otel özel renk temaları istersen burada değiştirebilirsin.
 * ----------------------------------------------------------*/
export const CAT_COLORS = {
  restaurant:'#FF6B2C',
  bar:'#A855F7',
  spa:'#14B8A6',
  cafe:'#F59E0B',
  shop:'#0EA5E9',
  toilet:'#64748B',
  reception:'#22C55E',
  beach:'#FB923C',
  aquapark:'#38BDF8',
  kidsclub:'#EF4444',
  elevator:'#9CA3AF',
  gate:'#6D28D9',
  parking:'#2563EB',
  shuttle:'#10B981',
  gym:'#DC2626',
  voleybol:'#8B5CF6', 
  pool:'#22D3EE',
  default:'#0EA5E9'
};

/* ------------------------------------------------------------
 * 2) KATEGORİ → İKON ID/ASSET
 *   - initMap.js → loadIcons() ile ./assets/icons/*.png yüklenir,
 *     layers.js → symbol layer 'icon-image' match'inde bu id'ler kullanılır.
 * ----------------------------------------------------------*/
export const ICONS = {
  restaurant: 'poi-restaurant.png',
  Havuz:      'poi-pool.png',
  voleybol:   'poi-voleybol.png',
  bar:        'poi-bar.png',
  spa:        'poi-spa.png',
  cafe:       'poi-cafe.png',
  shop:       'poi-shop.png',
  aquapark:   'poi-aquapark.png',
  toilet:     'poi-toilet.png',
  reception:  'poi-reception.png',
  beach:      'poi-beach.png',
  kidsclub:   'poi-kidsclub.png',
  parking:    'poi-parking.png',
  shuttle:    'poi-shuttle.png',
  gym:        'poi-gym.png',
  pool:       'poi-pool.png',
  default:    'poi-marker-default.png'
};

/* ------------------------------------------------------------
 * 3) E�?ANLAMLILAR (serbest metin → kategori)
 *   - Kullanıcının yazdığı farklı dillerdeki kelimeleri normalize
 *     ederek bir kategoriye map ederiz (örn "café" → "cafe").
 *   - Buraya yeni kelime eklemek güvenlidir; i18n sözlüklerinden bağımsızdır.
 * ----------------------------------------------------------*/
export const SYNONYMS = {
  bar:        ['bar','Ğ±Ğ°Ñ€'],
  cafe:       ['cafe','café','kafe','G�G�фG�','kawiarnia'],
  restaurant: ['restoran','restaurant','restauracja','Ñ€ĞµÑÑ‚Ğ¾Ñ€Ğ°Ğ½'],
  pool:       ['havuz','pool','basen','Ğ±Ğ°ÑÑĞµĞ¹Ğ½'],
  spa:        ['spa','wellness','ÑĞ¿Ğ°','sauna'],
  shop:       ['shop','market','sklep','Ğ¼Ğ°Ğ³Ğ°Ğ·Ğ¸Ğ½','butik'],
  toilet:     ['wc','toilet','tuvalet','toaleta','Ñ‚ÑƒĞ°Ğ»ĞµÑ‚'],
  reception:  ['reception','resepsiyon','recepcja','Ñ€ĞµÑĞµĞ¿ÑˆĞµĞ½'],
  beach:      ['beach','plaj','plaï¿½ï¿½a','ï¿½ï¿½ï¿½ï¿½ï¿½?ï¿½ï¿½'],
  aquapark:   ['aquapark','su parkï¿½ï¿½','water park','park wodny','ï¿½ï¿½ï¿½?ï¿½ï¿½ï¿½ï¿½?'],
  kidsclub:   ['kids club','mini club','G�G�тсG�G�G� G�G�уG�','club dziecięcy'],
  elevator:   ['elevator','lift','asansör','G�G�фт','winda'],
  gate:       ['gate','kapı','giriş','brama','eingang','G�G�рG�тG�'],
  parking:    ['parking','otopark','parkplatz','Ğ¿Ğ°Ñ€ĞºĞ¾Ğ²ĞºĞ°'],
  shuttle:    ['shuttle','servis','bus','autobus','ÑˆĞ°Ñ‚Ñ‚Ğ»'],
  gym:        ['gym','fitness','spor','fitnessstudio','siłownia'],
  voleybol:   ['voleybol','volleyball','siatkówka','G�G�G�G�G�G�G�G�'],
};

/* Ters sözlük: normalize edilmiş her kelime → kategori anahtarı */
const KEYWORD_TO_CAT = (() => {
  const map = {};
  Object.entries(SYNONYMS).forEach(([cat, arr]) => {
    arr.forEach(w => { map[norm(w)] = cat; });
  });
  return map;
})();

/* ------------------------------------------------------------
 * 4) detectCategory(q, lang)
 *   - Önce aktif dilin kategori ETİKETLERİNE bakar (I18N[lang].cats)
 *     → “Restoran”, “Kawiarnia” gibi resmi çeviri adlarından yakalama.
 *   - Bulamazsa SYNONYMS sözlüğüne bakar (serbest kelimeler).
 *   - Dönüş: 'restaurant' | 'cafe' | ... | null
 * ----------------------------------------------------------*/
export function detectCategory(query, lang) {
  if (!query) return null;
  const L = (SUP_LANGS.includes(lang) ? lang : 'en');
  const nq = norm(query);

  // 4.a) Dil sözlüğündeki resmi etiketlerden yakala (örn "Restoran")
  const dict = I18N[L]?.cats || {};
  for (const [catKey, label] of Object.entries(dict)) {
    // hem etiket içinde arama hem de terim içinde etiket araması
    const nlab = norm(label);
    if (nlab.includes(nq) || nq.includes(nlab)) return catKey;
  }

  // 4.b) Serbest kelime eşanlamlıları
  return KEYWORD_TO_CAT[nq] || null;
}

/* ------------------------------------------------------------
 * 5) Yardımcı: kategori filtresi uygula (MapLibre)
 *   - Nokta katmanları (indoor/outdoor) için ortak filtre uygular.
 *   - main/ui katmanında çağırmak için export ediyoruz (opsiyonel).
 * ----------------------------------------------------------*/
export function applyPoiCategoryFilter(map, cat) {
  // Sadece Point geometrileri kalsın
  const base = ['==', ['geometry-type'], 'Point'];
  // Kategori seçildiyse onu da ekle; yoksa tüm Point'ler
  const filt = cat ? ['all', base, ['==', ['get','category'], cat]] : base;

  const pointLayers = [
    'indoor-pts', 'outdoor-pts',
    'indoor-pts-badge','outdoor-pts-badge',
    'indoor-pts-shadow','outdoor-pts-shadow'
  ];
  pointLayers.forEach(id => {
    if (map.getLayer(id)) map.setFilter(id, filt);
  });
}
