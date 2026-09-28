// world/arayuz/modelSecici.ts — düşünce modelini seçme penceresi (M tuşu).
//
// NEDEN VAR: beyin eskiden yalnızca zihin duvarındaki DÜŞÜNCE düğümünden
// seçilebiliyordu — duvara yürü, panele odaklan, düğümü aç, −/+ ile çıplak
// adlar (`yerel:qwen3`) arasında tek tek dön, her adımda teyit ekranı. Hangi
// modelin kurulu, ne kadar büyük, araç çağırabilir olduğu hiçbir yerde
// yazmıyordu. Ozyn: "oradaki arayüz çok kötü".
//
// Burası odanın ÜSTÜNDE bir pencere: her yerden M ile açılır, kurulu Ollama
// modellerini kart olarak listeler (açılışta taranmış, pencere açılınca
// tazelenir), yazarak süzülür, ok + Enter ile seçilir.
//
// SEÇİM İKİ ADIMLI: ilk Enter/tık kartı "kurar" ve bedeli söyler (sohbet
// geçmişi taşınmaz); ikincisi geçer. Duvardaki teyit ekranının aynı
// sürtünmesi — beyin değiştirmek `tehlikeli` sınıfta bir ayar ve bir tuşla
// kazara olmamalı. Yazma yolu da aynı: kaynak `sec` kompozisyon kökünde
// devre panosunun teyit yoluna bağlıdır, ikinci bir yazma yolu açılmaz.
//
// Karar/sıra/süzgeç `modelSeciciCekirdek.ts`te (saf, testli); burası boyar.
// Bağımlılık sınırı (K4): yalnızca DOM + kardeş çekirdek. `bridge/` görmez.
"use strict";
import {
  suzVeGrupla, duzListe, sonrakiIndeks, baslangicIndeksi, kartHali, taramaSatiri,
  type ModelKarti, type ModelSeciciKaynagi, type KartHali,
} from "./modelSeciciCekirdek.ts";

export interface ModelSeciciAyari {
  kaynak: ModelSeciciKaynagi;
  /** Pencerenin kökü (`#modelSecici`). İçi burada kurulur. */
  kok: HTMLElement;
  /** Köşedeki "düşünce: …" rozeti (`#beyinRozet`); tıklayınca açar. */
  rozet?: HTMLElement;
  /**
   * M tuşu şu an serbest mi. Terminal odaktayken M bir harftir; sohbet
   * kutusu açıkken de. Karar kompozisyon kökünde — pencere odanın hâlini
   * bilmez.
   */
  tusSerbest?: () => boolean;
}

export interface ModelSecici {
  ac(): void;
  kapat(): void;
  acikMi(): boolean;
  /** Kart listesini yeniden kur (seçenek eklendiğinde). */
  tazele(): void;
}

/** Pencere açılınca tarama bundan eskiyse Ollama yeniden sorulur. */
const TAZELIK_MS = 20_000;

const HAL_YAZI: Record<KartHali, string> = {
  aktif: "düşünüyor",
  kontrol: "sağlık kontrolü…",
  reddedildi: "geçilemedi",
  hazir: "",
  uygunsuz: "seçilemez",
};

export function modelSeciciKur(ayar: ModelSeciciAyari): ModelSecici {
  const { kaynak, kok } = ayar;
  let acik = false;
  let suzgec = "";
  let imlec = -1;
  /** İki adımlı seçimde "kurulmuş" kart; ikinci Enter onu seçer. */
  let kurulu: string | null = null;
  let liste: ModelKarti[] = [];
  let mesaj: { metin: string; ton: "iyi" | "kotu" | "notr" } | null = null;
  /** Sağlık kontrolü sonucu beklenen seçim — bitince mesaj sonucu söyler. */
  let bekledigi: string | null = null;
  let yenileniyor = false;
  let saat: ReturnType<typeof setInterval> | undefined;

  // ── İskelet: bir kez kurulur; liste ve durumlar güncellenir ──────────
  kok.innerHTML = "";
  kok.setAttribute("role", "dialog");
  kok.setAttribute("aria-label", "Düşünce modeli seçici");
  const kutu = el("div", "ms-kutu");
  const bas = el("div", "ms-bas");
  const basSol = el("div", "ms-bas-sol");
  const baslik = el("div", "ms-baslik", "Düşünce modeli");
  const tarama = el("div", "ms-tarama");
  basSol.append(baslik, tarama);
  const yenileDugme = el("button", "ms-yenile", "↻ Yenile") as HTMLButtonElement;
  yenileDugme.type = "button";
  yenileDugme.title = "Ollama'yı yeniden tara";
  const kapatDugme = el("button", "ms-kapat", "✕") as HTMLButtonElement;
  kapatDugme.type = "button";
  kapatDugme.title = "kapat (Esc)";
  bas.append(basSol, yenileDugme, kapatDugme);

  const arama = el("input", "ms-arama") as HTMLInputElement;
  arama.type = "text";
  arama.placeholder = "süz: qwen, araç, 4B, bellekte…";
  arama.autocomplete = "off";
  arama.spellcheck = false;

  const govde = el("div", "ms-govde");
  const alt = el("div", "ms-alt");
  const altIpucu = el("div", "ms-ipucu");
  altIpucu.innerHTML = "<kbd>↑</kbd><kbd>↓</kbd> gez · <kbd>Enter</kbd> seç, tekrar <kbd>Enter</kbd> geç · <kbd>Esc</kbd> kapat";
  const altMesaj = el("div", "ms-mesaj");
  alt.append(altMesaj, altIpucu);
  kutu.append(bas, arama, govde, alt);
  kok.append(kutu);

  /** Kart adı → DOM düğümü; durum güncellemesi listeyi yeniden kurmaz. */
  const kartDom = new Map<string, HTMLElement>();

  function listeyiKur(): void {
    const gruplar = suzVeGrupla(kaynak.kartlar(), suzgec);
    liste = duzListe(gruplar);
    kartDom.clear();
    govde.innerHTML = "";
    if (!liste.length) {
      govde.append(el("div", "ms-bos", suzgec ? `"${suzgec}" ile eşleşen model yok` : "seçenek yok"));
    }
    for (const g of gruplar) {
      const bolum = el("section", "ms-grup");
      bolum.dataset.grup = g.grup;
      bolum.append(el("h3", "ms-grup-baslik", g.baslik));
      for (const k of g.kartlar) {
        const d = el("div", "ms-kart");
        d.dataset.grup = k.grup;
        d.setAttribute("role", "option");
        const ust = el("div", "ms-kart-ust");
        ust.append(el("span", "ms-nokta"), el("span", "ms-kart-baslik", k.baslik), el("span", "ms-hal"));
        const aciklama = el("div", "ms-kart-aciklama", k.uygun ? k.aciklama : (k.sebep ?? k.aciklama));
        const rozetler = el("div", "ms-rozetler");
        for (const r of k.rozetler) {
          const s = el("span", "ms-rozet", r.metin);
          s.dataset.ton = r.ton;
          rozetler.append(s);
        }
        d.append(ust, aciklama, rozetler);
        d.addEventListener("mouseenter", () => {
          const i = liste.indexOf(k);
          if (i >= 0 && k.uygun) { imlec = i; durumlariGuncelle(); }
        });
        d.addEventListener("click", () => { imlec = liste.indexOf(k); secimAdimi(); });
        kartDom.set(k.ad, d);
        bolum.append(d);
      }
      govde.append(bolum);
    }
    if (imlec >= liste.length || imlec < 0 || !liste[imlec]?.uygun) {
      imlec = baslangicIndeksi(liste, kaynak.durum());
    }
    durumlariGuncelle();
  }

  /** Durumlar canlı akar (sağlık kontrolü sürerken); yalnızca öznitelikler. */
  function durumlariGuncelle(): void {
    const d = kaynak.durum();
    tarama.textContent = taramaSatiri(kaynak.tarama(), Date.now());
    tarama.dataset.ton = kaynak.tarama()?.ulasildi === false ? "kotu" : "notr";
    yenileDugme.disabled = yenileniyor;
    yenileDugme.textContent = yenileniyor ? "↻ taranıyor…" : "↻ Yenile";
    liste.forEach((k, i) => {
      const dom = kartDom.get(k.ad);
      if (!dom) return;
      const hal = kartHali(k, d);
      dom.dataset.hal = hal;
      dom.dataset.imlec = i === imlec ? "1" : "0";
      dom.dataset.kurulu = kurulu === k.ad ? "1" : "0";
      dom.setAttribute("aria-selected", i === imlec ? "true" : "false");
      const halEl = dom.querySelector(".ms-hal")!;
      halEl.textContent = kurulu === k.ad ? "Enter · geç" : HAL_YAZI[hal];
    });
    // Beklenen geçiş sonuçlandı: "kontrol başladı" mesajı SONUCA döner.
    // Kalsaydı, geçiş reddedildiğinde bile ekranda yeşil bir "başladı" dururdu.
    if (bekledigi && d.gecis !== "kontrol") {
      const k = liste.find((x) => x.ad === bekledigi);
      if (d.gecis === "reddedildi" && d.hedef === bekledigi) {
        mesaj = { metin: `${k?.baslik ?? bekledigi} geçilemedi: ${d.sebep ?? "sebep yok"}`, ton: "kotu" };
      } else if (d.aktif === bekledigi) {
        mesaj = { metin: `✓ ${k?.baslik ?? bekledigi} artık düşünüyor`, ton: "iyi" };
      }
      bekledigi = null;
    }
    if (kurulu) {
      altMesaj.textContent = `${kurulu} seçilecek. Sohbet geçmişi yeni beyne TAŞINMAZ; ` +
        `sağlık kontrolü geçmezse mevcut beyin kalır. Onay: Enter ya da tekrar tık.`;
      altMesaj.dataset.ton = "uyari";
    } else {
      altMesaj.textContent = mesaj?.metin ?? `şu an: ${d.aktif}`;
      altMesaj.dataset.ton = mesaj?.ton ?? "notr";
    }
  }

  function imleciGorunurYap(): void {
    const k = liste[imlec];
    if (k) kartDom.get(k.ad)?.scrollIntoView({ block: "nearest" });
  }

  /** Enter/tık: ilk basış kurar, ikincisi geçer. */
  function secimAdimi(): void {
    const k = liste[imlec];
    if (!k || !k.uygun) return;
    const d = kaynak.durum();
    if (k.ad === d.aktif && d.gecis !== "kontrol") {
      kurulu = null;
      mesaj = { metin: `${k.baslik} zaten düşünüyor`, ton: "notr" };
      durumlariGuncelle();
      return;
    }
    if (kurulu !== k.ad) {
      kurulu = k.ad;
      mesaj = null;
      durumlariGuncelle();
      return;
    }
    kurulu = null;
    const red = kaynak.sec(k.ad);
    mesaj = red
      ? { metin: `reddedildi: ${red}`, ton: "kotu" }
      : { metin: `${k.baslik} için sağlık kontrolü başladı…`, ton: "notr" };
    bekledigi = red ? null : k.ad;
    durumlariGuncelle();
  }

  async function yenile(): Promise<void> {
    if (yenileniyor) return;
    yenileniyor = true;
    durumlariGuncelle();
    try { await kaynak.yenile(); }
    finally {
      yenileniyor = false;
      if (acik) listeyiKur(); else durumlariGuncelle();
    }
  }

  function ac(): void {
    if (acik) return;
    acik = true;
    kurulu = null;
    mesaj = null;
    suzgec = "";
    arama.value = "";
    imlec = -1;
    kok.dataset.acik = "1";
    // Kamera fareyi kilitlemişse kartlara tıklanamaz.
    document.exitPointerLock?.();
    listeyiKur();
    imleciGorunurYap();
    arama.focus();
    const t = kaynak.tarama();
    // Ollama yoksa her açılışta yeniden sorulur: bu arada başlatılmış olabilir.
    if (!t || !t.ulasildi || Date.now() - t.an > TAZELIK_MS) void yenile();
    // Geçiş sürerken hâl canlı değişir: kısa aralıklı, yalnız öznitelik.
    saat = setInterval(durumlariGuncelle, 250);
  }

  function kapat(): void {
    if (!acik) return;
    acik = false;
    kok.dataset.acik = "0";
    arama.blur();
    clearInterval(saat);
  }

  // ── Olaylar ──────────────────────────────────────────────────────────
  arama.addEventListener("input", () => {
    suzgec = arama.value;
    kurulu = null;
    imlec = -1;
    listeyiKur();
    // Süzgeç değişince liste baştan okunur; eski kaydırma yarım kart bırakırdı.
    govde.scrollTop = 0;
  });
  yenileDugme.addEventListener("click", () => void yenile());
  kapatDugme.addEventListener("click", kapat);
  // Pencerenin dışına (karartılmış zemine) tık kapatır.
  kok.addEventListener("mousedown", (e) => { if (e.target === kok) kapat(); });

  // Pencere açıkken tuşlar ODAYA SIZMAZ: süzgece "t" yazmak sohbeti açmamalı,
  // "1" Orion'u tahtaya yürütmemeli. Oda dinleyicileri `window`da, kabarma
  // evresinde; burada durdurmak yeter.
  kok.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Escape") { e.preventDefault(); if (kurulu) { kurulu = null; durumlariGuncelle(); } else kapat(); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const i = sonrakiIndeks(liste, imlec, e.key === "ArrowDown" ? 1 : -1);
      if (i !== imlec) kurulu = null;
      imlec = i;
      durumlariGuncelle();
      imleciGorunurYap();
      return;
    }
    if (e.key === "Enter") { e.preventDefault(); secimAdimi(); }
  });
  kok.addEventListener("keyup", (e) => e.stopPropagation());

  addEventListener("keydown", (e) => {
    if (acik || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key !== "m" && e.key !== "M") return;
    const h = e.target as HTMLElement | null;
    if (h && (h.tagName === "INPUT" || h.tagName === "TEXTAREA")) return;
    if (ayar.tusSerbest && !ayar.tusSerbest()) return;
    e.preventDefault();
    ac();
  });

  // ── Köşe rozeti: hangi beyin düşünüyor, her an görünür ───────────────
  if (ayar.rozet) {
    const rozet = ayar.rozet;
    rozet.addEventListener("click", () => (acik ? kapat() : ac()));
    let onceki = "";
    const rozetYaz = () => {
      const d = kaynak.durum();
      const k = kaynak.kartlar().find((x) => x.ad === d.aktif);
      rozet.dataset.grup = k?.grup ?? "dis";
      rozet.dataset.hal = d.gecis;
      const hedef = d.gecis === "kontrol" && d.hedef
        ? ` → ${kaynak.kartlar().find((x) => x.ad === d.hedef)?.baslik ?? d.hedef}` : "";
      const yazi = `düşünce: ${k?.baslik ?? d.aktif}${hedef}`;
      // Yarım saniyede bir DOM'u yeniden kurmak gereksiz: değişmediyse dokunma.
      const anahtar = `${rozet.dataset.grup}|${d.gecis}|${yazi}`;
      if (anahtar === onceki) return;
      onceki = anahtar;
      rozet.innerHTML = "";
      rozet.append(el("span", "ms-nokta"), el("span", "", yazi),
        el("kbd", "", "M"));
    };
    rozetYaz();
    setInterval(rozetYaz, 500);
  }

  return { ac, kapat, acikMi: () => acik, tazele: () => { if (acik) listeyiKur(); } };
}

function el(etiket: string, sinif: string, metin?: string): HTMLElement {
  const e = document.createElement(etiket);
  if (sinif) e.className = sinif;
  if (metin !== undefined) e.textContent = metin;
  return e;
}
