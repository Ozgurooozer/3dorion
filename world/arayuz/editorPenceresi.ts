// world/arayuz/editorPenceresi.ts — OYUN İÇİ METİN DÜZENLEYİCİ PENCERELERİ (Yapı çubuğu · Hafıza sekmesi, spec 32). DOM katmanı.
//
// Her dosya kendi penceresinde açılır (aynı dosya ikinci kez açılırsa mevcut pencere öne gelir): sürüklenir, köşesinden boyutlanır, tıklayınca öne çıkar.
// İçerik düz bir metin alanıdır — kopyala/yapıştır/kes/tümünü seç/geri al tarayıcının kendi davranışıdır. Eklenenler: Ctrl+S kaydet, Tab/Shift+Tab girinti, durum
// çubuğu (satır:sütun, karakter, ≈token, bağlamda mı), kaydedilmemiş nokta, kapatırken iki tıklı onay.
// Dosya kaynağı soyuttur (`DosyaKaynagi`): bugün md; kod dosyaları (sözdizimi renklendirme, başka kaynak) bu pencereyi genişleterek gelir — mantık `editorModeli.ts`te, testli.
// Yazarken tuşlar oyuna (WASD, T, B, M…) SIZMAZ: pencere kökünde klavye olayları durdurulur. Pencereler yalnız imleç kipinde görünür (`gorunur`); kapanınca gizlenir,
// KAYBOLMAZ (yazılmış metin durur), imleç kipi yeniden açılınca geri gelir.
"use strict";
import { diskDegisti, girintile, imlecYeri, kirliMi, sayilar, type DuzenleyiciDurumu } from "./editorModeli.ts";

export interface DosyaKaynagi {
  oku(ad: string): Promise<string>;
  /** Kaydeder; diskte gerçekten yazılan metni döner (sistem dosyalarında birleştirme olabilir). */
  yaz(ad: string, metin: string): Promise<string>;
}

export interface EditorPenceresiAyari {
  kaynak: DosyaKaynagi;
  /** Durum çubuğundaki dosyaya özgü bilgi (örn. "bağlamda ● ≈320 token"); verilmezse yok. */
  bilgi?: (ad: string) => string | null;
  /** Kısa mesajlar (kaydedildi, hata). Verilmezse yalnız durum çubuğunda. */
  altyazi?: (metin: string, ms?: number) => void;
  /** Sistemin yönettiği bölüm uyarısı gibi dosyaya özgü kısa not (başlık altında gösterilir). */
  not?: (ad: string) => string | null;
  /**
   * Kaynak yazılanı DEĞİŞTİRDİYSE (yazılan ≠ metin) gösterilen mesaj. Varsayılan md'ninki (anlık hafızanın otomatik bölümü); düğüm grafiği (spec 35)
   * kanonik biçime çevirir ve bunu söyler — md'nin metni orada yanlış olurdu.
   */
  degistiNotu?: string;
  ata?: HTMLElement;
}

export interface EditorPenceresi {
  /** Dosyayı yeni pencerede aç (açıksa öne getir). Okuma hatasında fırlatır. */
  ac(ad: string): Promise<void>;
  kapat(ad: string): void;
  /** Dosya dışarıdan değişti (örn. Orion anlık hafızayı güncelledi): açık pencere kararını verir. */
  icerikDegisti(ad: string): Promise<void>;
  /** Bilgi/not metinleri değişti (aktiflik gibi): açık pencerelerin durum çubuğunu tazele. */
  tazele(): void;
  acikDosyalar(): string[];
  /** Kaydedilmemiş değişikliği olan dosyalar. */
  kirliDosyalar(): string[];
  /** İmleç kipi kapanınca false (pencereler gizlenir, silinmez). */
  gorunur(acik: boolean): void;
  yokEt(): void;
}

const CSS = `
.ep-pencere { position: fixed; z-index: 40; display: flex; flex-direction: column; width: 640px; height: 460px; min-width: 320px; min-height: 200px; max-width: 96vw; max-height: 92vh;
  resize: both; overflow: hidden; background: rgba(10,14,24,0.985); color: #d7dcea; border: 1px solid #2a3246; border-radius: 10px; font: 13px/1.45 'Segoe UI', system-ui, sans-serif;
  box-shadow: 0 10px 34px rgba(0,0,0,.5); }
.ep-pencere[data-gizli="1"] { display: none; }
.ep-pencere[data-odak="1"] { border-color: #58c1ff; }
.ep-baslik { display: flex; align-items: center; gap: 8px; padding: 6px 8px 6px 12px; background: #121726; border-bottom: 1px solid #2a3246; cursor: move; user-select: none; }
.ep-baslik b { font-weight: 600; color: #eef1fa; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ep-nokta { color: #ffb454; font-size: 18px; line-height: 1; visibility: hidden; }
.ep-pencere[data-kirli="1"] .ep-nokta { visibility: visible; }
.ep-bosluk { flex: 1; }
.ep-dugme { background: #0d1320; color: #d7dcea; border: 1px solid #2a3246; border-radius: 6px; padding: 2px 10px; font: inherit; cursor: pointer; white-space: nowrap; }
.ep-dugme:hover:not(:disabled) { border-color: #58c1ff; }
.ep-dugme:disabled { opacity: 0.4; cursor: default; }
.ep-dugme[data-onay="1"] { border-color: #ffb454; color: #ffb454; }
.ep-not { padding: 5px 12px; background: rgba(88,193,255,0.08); color: #8fb8dc; font-size: 12px; border-bottom: 1px solid #2a3246; }
.ep-catisma { padding: 6px 12px; background: rgba(255,180,84,0.12); color: #ffcf8a; font-size: 12px; border-bottom: 1px solid #2a3246; display: none; gap: 8px; align-items: center; flex-wrap: wrap; }
.ep-pencere[data-catisma="1"] .ep-catisma { display: flex; }
.ep-metin { flex: 1; min-height: 0; width: 100%; box-sizing: border-box; resize: none; border: 0; outline: none; padding: 10px 12px; background: #0b101c; color: #e3e8f6;
  font: 13px/1.55 'Cascadia Mono', Consolas, monospace; tab-size: 2; white-space: pre-wrap; user-select: text; }
.ep-durum { display: flex; gap: 14px; padding: 4px 12px; background: #121726; border-top: 1px solid #2a3246; color: #7c88a6; font-size: 12px; white-space: nowrap; overflow: hidden; }
.ep-durum span:last-child { margin-left: auto; color: #8fb8dc; overflow: hidden; text-overflow: ellipsis; }
`;

const ONAY_MS = 3000;
const Z_ALT = 40, Z_UST = 55;
let stilEkli = false;

const yazilabilir = (h: EventTarget | null): boolean => !!(h as HTMLElement | null)?.matches?.("textarea, input");

interface Acik {
  ad: string;
  kok: HTMLElement;
  alan: HTMLTextAreaElement;
  durum: DuzenleyiciDurumu;
  tazele: () => void;
  kirli: () => boolean;
  catismayiCoz: () => Promise<void>;
}

export function editorPenceresiKur(a: EditorPenceresiAyari): EditorPenceresi {
  if (!stilEkli) {
    const stil = document.createElement("style");
    stil.textContent = CSS;
    document.head.append(stil);
    stilEkli = true;
  }
  const el = <K extends keyof HTMLElementTagNameMap>(ad: K, sinif = "", metin = ""): HTMLElementTagNameMap[K] => {
    const e = document.createElement(ad); if (sinif) e.className = sinif; if (metin) e.textContent = metin; return e;
  };
  const acikPencereler = new Map<string, Acik>();
  let gorunurMu = true;
  let basamak = 0;

  /** Öne al: sıra korunur, z-index 40..55 aralığında kalır (bağlam menüsü 58, panel 57: pencere asla menünün üstüne çıkmaz). */
  const one = (p: Acik) => {
    const sirali = [...acikPencereler.values()].filter((x) => x !== p).sort((x, y) => Number(x.kok.style.zIndex) - Number(y.kok.style.zIndex));
    sirali.push(p);
    sirali.forEach((x, i) => { x.kok.style.zIndex = String(Z_ALT + Math.min(i, Z_UST - Z_ALT)); });
    for (const x of acikPencereler.values()) x.kok.dataset.odak = x === p ? "1" : "0";
  };

  function kur(ad: string, ilkMetin: string): Acik {
    const durum: DuzenleyiciDurumu = { metin: ilkMetin, disk: ilkMetin };
    const kok = el("div", "ep-pencere");
    kok.dataset.kirli = "0"; kok.dataset.catisma = "0"; kok.dataset.gizli = gorunurMu ? "0" : "1"; kok.dataset.odak = "0";
    const konum = 90 + (basamak++ % 8) * 28;
    kok.style.left = `${Math.min(konum, innerWidth - 340)}px`; kok.style.top = `${Math.min(konum, innerHeight - 220)}px`;

    const baslik = el("div", "ep-baslik");
    const ad_ = el("b", "", ad);
    const nokta = el("span", "ep-nokta", "●"); nokta.title = "kaydedilmemiş değişiklik var";
    const kaydet = el("button", "ep-dugme", "Kaydet"); kaydet.title = "Ctrl+S";
    const yenile = el("button", "ep-dugme", "Yenile"); yenile.title = "Diskteki hâli yeniden oku (kaydedilmemiş değişiklik gider)";
    const kopyala = el("button", "ep-dugme", "Kopyala"); kopyala.title = "Bütün metni panoya kopyala";
    const kapatDugme = el("button", "ep-dugme", "✕"); kapatDugme.title = "Kapat";
    for (const b of [kaydet, yenile, kopyala, kapatDugme]) b.type = "button";
    baslik.append(ad_, nokta, el("span", "ep-bosluk"), kaydet, yenile, kopyala, kapatDugme);

    const notSatiri = a.not?.(ad) ? el("div", "ep-not", a.not(ad)!) : null;
    const catisma = el("div", "ep-catisma");
    catisma.append(el("span", "", "Dosya diskte değişti (sen de değiştirdin)."));
    const diskAl = el("button", "ep-dugme", "Diskteki hâli al"); diskAl.type = "button";
    const koru = el("button", "ep-dugme", "Benimkini koru"); koru.type = "button"; koru.title = "Kaydedince benim metnim yazılır (anlık hafızada otomatik bölüm sistemde kalır)";
    catisma.append(diskAl, koru);

    const alan = el("textarea", "ep-metin");
    alan.value = ilkMetin; alan.spellcheck = false; alan.wrap = "soft"; alan.setAttribute("autocapitalize", "off");
    const durumCubugu = el("div", "ep-durum");
    const konumYazisi = el("span"), sayiYazisi = el("span"), mesajYazisi = el("span");
    durumCubugu.append(konumYazisi, sayiYazisi, mesajYazisi);
    kok.append(baslik, ...(notSatiri ? [notSatiri] : []), catisma, alan, durumCubugu);
    (a.ata ?? document.body).append(kok);

    let mesajZamani: ReturnType<typeof setTimeout> | undefined;
    let mesajVar = false;
    const mesaj = (m: string, ms = 2500) => {
      mesajVar = true; mesajYazisi.textContent = m; clearTimeout(mesajZamani);
      mesajZamani = setTimeout(() => { mesajVar = false; mesajYazisi.textContent = a.bilgi?.(ad) ?? ""; }, ms);
    };
    const tazele = () => {
      const y = imlecYeri(alan.value, alan.selectionStart);
      konumYazisi.textContent = `Sat ${y.satir}, Süt ${y.sutun}`;
      const s = sayilar(alan.value);
      sayiYazisi.textContent = `${s.karakter} karakter · ${s.satir} satır · ≈${Math.ceil(s.karakter / 3)} token`;
      kok.dataset.kirli = kirliMi(durum) ? "1" : "0";
      if (!mesajVar) mesajYazisi.textContent = a.bilgi?.(ad) ?? "";
    };

    const metniKoy = (metin: string) => {
      const konum = Math.min(alan.selectionStart, metin.length);
      alan.value = metin; alan.setSelectionRange(konum, konum);
      durum.metin = metin;
    };

    const kaydetIs = async () => {
      try {
        const yazilan = await a.kaynak.yaz(ad, alan.value);
        const degisti = yazilan !== alan.value;
        durum.disk = yazilan;
        if (degisti) metniKoy(yazilan); else durum.metin = alan.value;
        kok.dataset.catisma = "0";
        tazele();
        mesaj(degisti ? (a.degistiNotu ?? "kaydedildi (otomatik bölüm sistemde korundu)") : "kaydedildi");
      } catch (err) {
        const m = err instanceof Error ? err.message : String(err);
        mesaj(`KAYDEDİLEMEDİ: ${m}`, 8000);
        a.altyazi?.(`${ad} kaydedilemedi: ${m}`, 5000);
      }
    };
    const diskten = async () => {
      try {
        const disk = await a.kaynak.oku(ad);
        durum.disk = disk; metniKoy(disk); kok.dataset.catisma = "0"; tazele(); mesaj("diskten yenilendi");
      } catch (err) { mesaj(`okunamadı: ${err instanceof Error ? err.message : String(err)}`, 8000); }
    };

    alan.addEventListener("input", () => { durum.metin = alan.value; tazele(); });
    for (const o of ["keyup", "click", "select"] as const) alan.addEventListener(o, tazele);
    alan.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyS") { e.preventDefault(); void kaydetIs(); return; }
      if (e.key === "Tab" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        const r = girintile(alan.value, alan.selectionStart, alan.selectionEnd, e.shiftKey);
        if (r.metin !== alan.value) { alan.value = r.metin; durum.metin = r.metin; }
        alan.setSelectionRange(r.bas, r.son);
        tazele();
        return;
      }
      if (e.key === "Escape") { e.preventDefault(); alan.blur(); }
    });
    // Yazarken tuşlar oyuna sızmasın (WASD, T, B, M, Y…); fare olayları pencereyi öne alır.
    kok.addEventListener("keydown", (e) => { e.stopPropagation(); });
    kok.addEventListener("keyup", (e) => { e.stopPropagation(); });
    kok.addEventListener("keypress", (e) => { e.stopPropagation(); });
    kok.addEventListener("contextmenu", (e) => { if (!yazilabilir(e.target)) e.preventDefault(); e.stopPropagation(); });
    kok.addEventListener("wheel", (e) => { e.stopPropagation(); }, { passive: true });
    const p: Acik = { ad, kok, alan, durum, tazele, kirli: () => kirliMi(durum), catismayiCoz: diskten };
    kok.addEventListener("pointerdown", () => one(p));
    alan.addEventListener("focus", () => one(p));

    kaydet.addEventListener("click", () => { void kaydetIs(); kaydet.blur(); });
    yenile.addEventListener("click", () => { void diskten(); yenile.blur(); });
    diskAl.addEventListener("click", () => { void diskten(); });
    koru.addEventListener("click", () => { kok.dataset.catisma = "0"; tazele(); mesaj("kendi metnin korundu; kaydedince yazılır"); });
    kopyala.addEventListener("click", () => {
      void navigator.clipboard.writeText(alan.value).then(() => mesaj("panoya kopyalandı"), (err: unknown) => mesaj(`kopyalanamadı: ${err instanceof Error ? err.message : String(err)}`, 5000));
      kopyala.blur();
    });
    let onayZamani: ReturnType<typeof setTimeout> | undefined;
    kapatDugme.addEventListener("click", () => {
      if (kirliMi(durum) && kapatDugme.dataset["onay"] !== "1") {
        kapatDugme.dataset["onay"] = "1"; kapatDugme.textContent = "Kaydedilmedi! Tekrar tıkla";
        onayZamani = setTimeout(() => { kapatDugme.dataset["onay"] = "0"; kapatDugme.textContent = "✕"; }, ONAY_MS);
        return;
      }
      clearTimeout(onayZamani); clearTimeout(mesajZamani);
      kapatPencere(ad);
    });

    // Başlıktan sürükle (görünüm penceresinin içinde kalır).
    let tut: { dx: number; dy: number } | null = null;
    baslik.addEventListener("pointerdown", (e) => {
      if ((e.target as HTMLElement).closest("button")) return;
      const r = kok.getBoundingClientRect();
      tut = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      baslik.setPointerCapture?.(e.pointerId); e.preventDefault();
    });
    baslik.addEventListener("pointermove", (e) => {
      if (!tut) return;
      kok.style.left = `${Math.max(0, Math.min(innerWidth - 120, e.clientX - tut.dx))}px`;
      kok.style.top = `${Math.max(0, Math.min(innerHeight - 40, e.clientY - tut.dy))}px`;
    });
    const birak = () => { tut = null; };
    baslik.addEventListener("pointerup", birak); baslik.addEventListener("pointercancel", birak);

    tazele();
    return p;
  }

  function kapatPencere(ad: string): void {
    const p = acikPencereler.get(ad);
    if (!p) return;
    p.kok.remove();
    acikPencereler.delete(ad);
  }

  return {
    async ac(ad) {
      const var_ = acikPencereler.get(ad);
      if (var_) { one(var_); var_.alan.focus(); return; }
      const metin = await a.kaynak.oku(ad);
      const p = kur(ad, metin);
      acikPencereler.set(ad, p);
      one(p);
      p.alan.focus();
    },
    kapat: kapatPencere,
    async icerikDegisti(ad) {
      const p = acikPencereler.get(ad);
      if (!p) return;
      let disk: string;
      try { disk = await a.kaynak.oku(ad); } catch { return; }
      const karar = diskDegisti(p.durum, disk);
      if (karar === "yenile") {
        const konum = Math.min(p.alan.selectionStart, disk.length);
        p.alan.value = disk; p.durum.metin = disk; p.durum.disk = disk;
        p.alan.setSelectionRange(konum, konum);
        p.tazele();
      } else if (karar === "catisma") {
        // Ozyn'in yazdığı ezilmez: banner çıkar. Diskin yeni hâli "bilinen disk" olur ki "benimkini koru" sonrası tekrar çakışma sayılmasın.
        p.durum.disk = disk;
        p.kok.dataset.catisma = "1";
        p.tazele();
      }
    },
    tazele() { for (const p of acikPencereler.values()) p.tazele(); },
    acikDosyalar: () => [...acikPencereler.keys()],
    kirliDosyalar: () => [...acikPencereler.values()].filter((p) => p.kirli()).map((p) => p.ad),
    gorunur(acik) {
      gorunurMu = acik;
      for (const p of acikPencereler.values()) p.kok.dataset.gizli = acik ? "0" : "1";
    },
    yokEt() { for (const ad of [...acikPencereler.keys()]) kapatPencere(ad); },
  };
}
