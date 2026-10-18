// world/arayuz/altCubukModeli.ts — ALT ÇUBUK (Yapı çubuğu) MODELİ: sekme kaydı + açık/kapalı + etkin sekme. SAF (DOM ve Babylon yok).
//
// Alt çubuk ekranın altında açılır-kapanır bir panel; içinde SEKMELER var (bugün Asset ve Zemin; ileride çok daha fazlası). Bu dosya yalnız "hangi sekmeler var,
// hangisi etkin, panel açık mı" kararını tutar; görünüm `altCubuk.ts`te, sekme içerikleri uygulama katmanında. Böylece yeni sekme = bir `ekle` çağrısı: model,
// sıralama, devre dışı bırakma, kısayol ve kalıcılık değişmez.
//   • Sıra: `sira` küçük olan solda; eşitse ekleme sırası. Aynı kimlik iki kez eklenemez (HATA: sessizce üstüne yazmak sekmeyi kaybettirirdi).
//   • `sekmeyeTikla`: kapalıyken açar+seçer; açıkken başka sekmeyse geçer; AYNI sekmeyse kapatır (Sims'teki gibi: etkin sekmeye tekrar tık paneli indirir).
//   • `engelle(id, neden)`: sekme gri olur, seçilemez, neden ipucunda söylenir (örn. "dünya henüz hazır değil"); engelli sekme etkinse panel başka sekmeye düşmez, kapanır.
//   • Kalıcılık: yalnız son ETKİN sekme saklanır (panel her açılışta kapalı başlar: görüşü kapatmasın). Bozuk kayıt HATA (çağıran uyarır, boşla devam eder).
"use strict";

export interface SekmeBilgisi {
  readonly id: string;
  /** Sekme şeridinde görünen ad. */
  readonly ad: string;
  /** Adın yanındaki kısa simge (emoji ya da 1–2 karakter). */
  readonly simge: string;
  /** Soldan sağa sıra (küçük önce). */
  readonly sira: number;
  /** Üzerine gelince gösterilen açıklama. */
  readonly ipucu?: string;
}

export interface AltCubukDurumu { readonly acik: boolean; readonly etkin: string | null }
export interface AltCubukOlayi { readonly simdi: AltCubukDurumu; readonly onceki: AltCubukDurumu }

export interface AltCubukModeli {
  ekle(s: SekmeBilgisi): void;
  /** Sıraya göre. */
  sekmeler(): readonly SekmeBilgisi[];
  durum(): AltCubukDurumu;
  /** Sekmeyi etkin yapar ve paneli açar. Engelliyse ya da bilinmiyorsa false (bilinmeyen kimlik HATA). */
  sec(id: string): boolean;
  /** Şerit tıklaması: kapalıysa açıp seçer, başka sekmeyse geçer, etkin sekmeyse kapatır. */
  sekmeyeTikla(id: string): boolean;
  /** Paneli açar (etkin sekme yoksa ilk engelsiz sekme). Açılacak sekme yoksa false. */
  ac(): boolean;
  kapat(): boolean;
  degistir(): boolean;
  engelle(id: string, neden: string | null): void;
  /** Engel nedeni (engelli değilse null). */
  engel(id: string): string | null;
  dinle(f: (o: AltCubukOlayi) => void): () => void;
  /** Saklanacak metin / saklanmış metni oku (bozuksa HATA). */
  yaz(): string;
  yukle(metin: string | null): void;
}

export function altCubukModeliKur(): AltCubukModeli {
  const liste: { bilgi: SekmeBilgisi; sira: number }[] = [];
  const engeller = new Map<string, string>();
  const dinleyiciler = new Set<(o: AltCubukOlayi) => void>();
  let acik = false;
  let etkin: string | null = null;
  /** Panel kapalıyken bile hatırlanan son sekme: `yukle` bunu doldurur, `ac` buradan başlar. */
  let sonEtkin: string | null = null;

  const sirali = () => [...liste].sort((a, b) => a.bilgi.sira - b.bilgi.sira || a.sira - b.sira).map((x) => x.bilgi);
  const bul = (id: string): SekmeBilgisi => {
    const s = liste.find((x) => x.bilgi.id === id);
    if (!s) throw new Error(`alt çubuk: "${id}" adlı sekme yok`);
    return s.bilgi;
  };
  const durum = (): AltCubukDurumu => ({ acik, etkin });
  function degistir(f: () => void): boolean {
    const onceki = durum();
    f();
    const simdi = durum();
    if (onceki.acik === simdi.acik && onceki.etkin === simdi.etkin) return false;
    for (const d of [...dinleyiciler]) d({ simdi, onceki });
    return true;
  }
  const secilebilir = (id: string) => !engeller.has(id);

  const m: AltCubukModeli = {
    ekle(s) {
      if (liste.some((x) => x.bilgi.id === s.id)) throw new Error(`alt çubuk: "${s.id}" sekmesi zaten ekli`);
      liste.push({ bilgi: s, sira: liste.length });
    },
    sekmeler: sirali,
    durum,
    sec(id) {
      bul(id);
      if (!secilebilir(id)) return false;
      degistir(() => { etkin = id; sonEtkin = id; acik = true; });
      return true;
    },
    sekmeyeTikla(id) {
      bul(id);
      if (!secilebilir(id)) return false;
      if (acik && etkin === id) { m.kapat(); return true; }
      return m.sec(id);
    },
    ac() {
      const hedef = (sonEtkin && liste.some((x) => x.bilgi.id === sonEtkin) && secilebilir(sonEtkin) ? sonEtkin : null) ?? sirali().find((s) => secilebilir(s.id))?.id ?? null;
      if (!hedef) return false;
      return m.sec(hedef);
    },
    kapat() { return degistir(() => { acik = false; etkin = null; }); },
    degistir() { return acik ? m.kapat() : m.ac(); },
    engelle(id, neden) {
      bul(id);
      degistir(() => {
        if (neden === null) { engeller.delete(id); return; }
        engeller.set(id, neden);
        if (etkin === id) { acik = false; etkin = null; }
      });
    },
    engel: (id) => engeller.get(id) ?? null,
    dinle(f) { dinleyiciler.add(f); return () => { dinleyiciler.delete(f); }; },
    yaz: () => JSON.stringify({ surum: 1, etkin: etkin ?? sonEtkin }),
    yukle(metin) {
      if (!metin) return;
      const v: unknown = JSON.parse(metin);
      if (typeof v !== "object" || v === null) throw new Error("alt çubuk kaydı nesne değil");
      const o = v as Record<string, unknown>;
      if (o["surum"] !== 1) throw new Error(`alt çubuk kaydı sürümü desteklenmiyor: ${String(o["surum"])}`);
      if (o["etkin"] !== null && typeof o["etkin"] !== "string") throw new Error("alt çubuk kaydı: etkin sekme bozuk");
      // Sekme sonradan kaldırılmış olabilir: bilinmeyen kimlik sessizce düşer (ilk sekmeyle başlanır), kayıt bozuk sayılmaz.
      sonEtkin = typeof o["etkin"] === "string" && liste.some((x) => x.bilgi.id === o["etkin"]) ? o["etkin"] : null;
    },
  };
  return m;
}
