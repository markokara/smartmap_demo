/**
 * src/i18n.js
 * ============================================================
 * Çok dillilik (i18n) yardımcıları
 * - Metin sözlükleri (I18N)
 * - Desteklenen diller (SUP_LANGS)
 * - Dil seçimi çözümleyici (resolveLang)
 * - Dil değiştirme (setLang)
 * - Metin okuma yardımcıları (t, tt)
 *
 * Tasarım hedefi: Basit, bozulmaz, yan etkiler kontrollü.
 *
 * Dış bağımlılıklar:
 * - CONFIG.FEATURES.defaultLanguage (opsiyonel başlangıç dili)
 *   → main.js, config.js’ten CONFIG’i import eder ve buraya iletir.
 */

/* ------------------------------------------------------------
 * 1) DESTEKLENEN DİLLER LİSTESİ
 *   - ISO 639-1 iki harf kodları.
 *   - Yeni dil ekleyecekseniz: SUP_LANGS’a kodu ekleyin + I18N’e sözlüğünü yazın.
 * ----------------------------------------------------------*/
export const SUP_LANGS = ["tr", "en", "ru", "de", "pl"];

/* ------------------------------------------------------------
 * 2) METİN SÖZLÜKLERİ (I18N)
 *   - Yapı: { <lang>: { ...uiStrings } }
 *   - Metinleri kategorize ettik:
 *       .searchPH  → arama placeholder
 *       .go        → “Git”/“Go” butonu
 *       .ui        → buton ve menü metinleri
 *       .labels    → popup içinde alan adları (saat, kat, açıklama)
 *       .cats      → kategori adları (POI türleri)
 *       .nav       → turn-by-turn yönlendirme metinleri
 *   - İPUCU: Bir metin eksikse, okurken “fallback zinciri” çalışır:
 *            I18N[lang]?.x || I18N[default]?.x || I18N.tr?.x
 * ----------------------------------------------------------*/
export const I18N = {
  tr: {
    searchPH: "Ara: restoran, spa, havuz…",
    go: "Git",
    ui: {
      pickStart: "Başlangıç Seç",
      pickDest: "Hedef Seç",
      followOn: "📍 Konum: Açık",
      followOff: "📍 Konum: Kapalı",
      reset: "Sıfırla",
      clearRoute: "Rota Temizle",
    },
    labels: { name: "İsim", category: "Tür", hours: "Saat", level: "Kat", desc: "Açıklama" },
    cats: {
      pool: "Havuz", restaurant: "Restoran", spa: "Spa", bar: "Bar", cafe: "Kafe",
      shop: "Dükkan", toilet: "WC", reception: "Resepsiyon", beach: "Plaj",
      aquapark: "Aquapark",
      kidsclub: "Çocuk Kulübü", elevator: "Asansör", gate: "Kapı",
      parking: "Otopark", shuttle: "Servis", gym: "Spor Salonu"
    },
    nav: {
      depart: "Başla",
      arrive: "Varış",
      turn_left: "Sola dön",
      turn_right: "Sağa dön",
      straight: "Düz devam",
      roundabout: "Göbekte %n. çıkış",
      onto: " → %s",
    }
  },

  en: {
    searchPH: "Search: restaurant, spa, pool…",
    go: "Go",
    ui: {
      pickStart: "Pick Start",
      pickDest: "Pick Destination",
      followOn: "📍 Location: On",
      followOff: "📍 Location: Off",
      reset: "Reset",
      clearRoute: "Clear Route",
    },
    labels: { name: "Name", category: "Type", hours: "Hours", level: "Level", desc: "Description" },
    cats: {
      pool: "Pool", restaurant: "Restaurant", spa: "Spa", bar: "Bar", cafe: "Cafe",
      shop: "Shop", toilet: "Toilet", reception: "Reception", beach: "Beach",
      aquapark: "Aquapark",
      kidsclub: "Kids Club", elevator: "Elevator", gate: "Gate",
      parking: "Parking", shuttle: "Shuttle", gym: "Gym"
    },
    nav: {
      depart: "Depart",
      arrive: "Arrive",
      turn_left: "Turn left",
      turn_right: "Turn right",
      straight: "Go straight",
      roundabout: "At roundabout take exit %n",
      onto: " onto %s",
    }
  },

  de: {
    searchPH: "Suche: Restaurant, Spa, Pool…",
    go: "Los",
    ui: {
      pickStart: "Start wählen",
      pickDest: "Ziel wählen",
      followOn: "📍 Standort: An",
      followOff: "📍 Standort: Aus",
      reset: "Zurücksetzen",
      clearRoute: "Route löschen",
    },
    labels: { name: "Name", category: "Typ", hours: "Öffnungszeiten", level: "Etage", desc: "Beschreibung" },
    cats: {
      pool: "Pool", restaurant: "Restaurant", spa: "Spa/Wellness", bar: "Bar", cafe: "Café",
      shop: "Shop", toilet: "Toilette", reception: "Rezeption", beach: "Strand",
      aquapark: "Aquapark",
      kidsclub: "Kinderclub", elevator: "Aufzug", gate: "Eingangstor",
      parking: "Parkplatz", shuttle: "Shuttle", gym: "Fitnessstudio"
    },
    nav: {
      depart: "Start",
      arrive: "Ankunft",
      turn_left: "Links abbiegen",
      turn_right: "Rechts abbiegen",
      straight: "Geradeaus",
      roundabout: "Im Kreisverkehr Ausfahrt %n nehmen",
      onto: " auf %s",
    }
  },

  ru: {
    searchPH: "Поиск: ресторан, спа, бассейн…",
    go: "Поехали",
    ui: {
      pickStart: "Выбрать старт",
      pickDest: "Выбрать пункт",
      followOn: "📍 Местоположение: Вкл",
      followOff: "📍 Местоположение: Выкл",
      reset: "Сброс",
      clearRoute: "Очистить маршрут",
    },
    labels: { name: "Название", category: "Тип", hours: "Часы", level: "Этаж", desc: "Описание" },
    cats: {
      pool: "Бассейн", restaurant: "Ресторан", spa: "Спа", bar: "Бар", cafe: "Кафе",
      shop: "Магазин", toilet: "Туалет", reception: "Ресепшен", beach: "Пляж",
      aquapark: "Аквапарк",
      kidsclub: "Детский клуб", elevator: "Лифт", gate: "Вход/ворота",
      parking: "Парковка", shuttle: "Шаттл", gym: "Спортзал"
    },
    nav: {
      depart: "Начать",
      arrive: "Прибытие",
      turn_left: "Поверните налево",
      turn_right: "Поверните направо",
      straight: "Двигайтесь прямо",
      roundabout: "На круге поверните — съезд №%n",
      onto: " на %s",
    }
  },

  pl: {
    searchPH: "Szukaj: restauracja, spa, basen…",
    go: "Jedź",
    ui: {
      pickStart: "Wybierz start",
      pickDest: "Wybierz cel",
      followOn: "📍 Lokalizacja: Wł",
      followOff: "📍 Lokalizacja: Wył",
      reset: "Resetuj",
      clearRoute: "Wyczyść trasę",
    },
    labels: { name: "Nazwa", category: "Typ", hours: "Godziny", level: "Poziom", desc: "Opis" },
    cats: {
      pool: "Basen", restaurant: "Restauracja", spa: "Spa", bar: "Bar", cafe: "Kawiarnia",
      shop: "Sklep", toilet: "Toaleta", reception: "Recepcja", beach: "Plaża",
      aquapark: "Aquapark",
      kidsclub: "Klub dziecięcy", elevator: "Winda", gate: "Brama/Wejście",
      parking: "Parking", shuttle: "Shuttle", gym: "Siłownia"
    },
    nav: {
      depart: "Start",
      arrive: "Meta",
      turn_left: "Skręć w lewo",
      turn_right: "Skręć w prawo",
      straight: "Jedź prosto",
      roundabout: "Na rondzie zjedź zjazdem nr %n",
      onto: " na %s",
    }
  }
};

/* ------------------------------------------------------------
 * 3) İÇ YARDIMCI: normalize (aksan vb. kaldırma)
 *   - Arama/sınıflama işlemlerinde dil bağımsız kıyas için kullanışlı.
 *   - i18n dışındaki modüller de import edip kullanabilir.
 * ----------------------------------------------------------*/
export const norm = (s) =>
  (s ?? "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/* ------------------------------------------------------------
 * 4) DİL SEÇME MANTIĞI
 *   - Öncelik sırası:
 *       a) localStorage.lang (kullanıcı seçimi)
 *       b) CONFIG.FEATURES.defaultLanguage (opsiyonel varsayılan)
 *       c) Tarayıcı dili (navigator.language → "tr", "en", …)
 *       d) "en" (en azından İngilizce)
 *   - SUP_LANGS dışında bir dil gelirse en yakın desteklenene düşer.
 *
 *   Not: resolveLang, main.js’ten CONFIG’i opsiyonel alır;
 *   almazsa sadece (a) ve (c)/(d) ile çalışır.
 * ----------------------------------------------------------*/
export function resolveLang(CONFIG) {
  // a) Kullanıcı tercihi var mı?
  let L = localStorage.getItem("lang");

  // b) Yoksa config varsayılanı?
  if (!L && CONFIG?.FEATURES?.defaultLanguage) {
    L = CONFIG.FEATURES.defaultLanguage;
  }

  // c) Hâlâ yoksa tarayıcı dili
  if (!L) {
    const nav = (navigator.language || navigator.userLanguage || "en")
      .slice(0, 2)
      .toLowerCase();
    L = SUP_LANGS.includes(nav) ? nav : "en";
  }

  // d) Son güvenlik: yine de desteklenmiyorsa "en"
  if (!SUP_LANGS.includes(L)) L = "en";

  // Seçimi kalıcı yap
  localStorage.setItem("lang", L);
  return L;
}

/* ------------------------------------------------------------
 * 5) DİLİ ELLE DEĞİŞTİRME
 *   - Ayarlarda dil seçici koyarsan burayı kullan.
 *   - setLang(lang) → localStorage.lang güncellenir.
 *   - Dönüş: seçilen dilin gerçekten SUP_LANGS içinde normalize edilmiş hâli.
 * ----------------------------------------------------------*/
export function setLang(lang) {
  const L = SUP_LANGS.includes(lang) ? lang : resolveLang();
  localStorage.setItem("lang", L);
  return L;
}

/* ------------------------------------------------------------
 * 6) METİN ERİŞİM YARDIMCILARI
 *   - t(lang?): dilin tüm sözlüğünü döner (fallback dâhil).
 *   - tt(path, lang?): tek bir anahtarı güvenle okur (örn "ui.pickStart").
 *
 *   Kullanım:
 *     t().ui.reset
 *     tt("ui.pickStart")
 *     tt("nav.roundabout", "de")
 * ----------------------------------------------------------*/
export function t(lang) {
  const L = lang || localStorage.getItem("lang") || "en";
  const base = I18N[L] || I18N.en || I18N.tr;
  // Basit fallback: eksik anahtarları TR/EN’den tamamlamak istersen
  // burada derin bir merge yapılabilir; şimdilik base yeterli.
  return base;
}

export function tt(path, lang) {
  // "ui.pickStart" → ["ui","pickStart"]
  const parts = (path || "").split(".");
  const dict = t(lang);
  let cur = dict;
  for (const p of parts) {
    cur = cur?.[p];
    if (cur == null) break;
  }
  // Fallback stratejisi: bulunamazsa İngilizce → Türkçe → anahtar metni
  if (cur != null) return cur;
  const dictEn = I18N.en;
  const dictTr = I18N.tr;
  cur = parts.reduce((a, p) => (a ? a[p] : undefined), dictEn);
  if (cur != null) return cur;
  cur = parts.reduce((a, p) => (a ? a[p] : undefined), dictTr);
  return cur ?? path; // en sonda anahtarın kendisini dönder (debug için yararlı)
}

/* ------------------------------------------------------------
 * 7) UI UYGULAMA: Basit örnek yardımcı (opsiyonel)
 *   - index.html’deki temel buton/placeholder metinlerini tek seferde basar.
 *   - main.js içinde resolveLang çağrısından sonra kullanılabilir.
 * ----------------------------------------------------------*/
export function applyBasicUIText() {
  const L = t(); // geçerli sözlük
  const $ = (id) => document.getElementById(id);

  // Arama placeholder
  const q = $("q");
  if (q) q.placeholder = L.searchPH || I18N.en.searchPH;

  // Butonlar
  const pickStart = $("pickStart");
  if (pickStart) pickStart.textContent = tt("ui.pickStart");

  const pickDest = $("pickDest");
  if (pickDest) pickDest.textContent = tt("ui.pickDest");

  const go = $("go");
  if (go) go.textContent = tt("go");

  const follow = $("follow");
  if (follow) follow.textContent = tt("ui.followOff"); // ilk yüklemede follow kapalı varsayıyoruz

  const reset = $("reset");
  if (reset) reset.textContent = tt("ui.reset");

  const clear = $("clearRoute");
  if (clear) clear.textContent = tt("ui.clearRoute");
}













