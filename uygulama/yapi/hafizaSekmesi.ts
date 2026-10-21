// uygulama/yapi/hafizaSekmesi.ts — ALT ÇUBUK · HAFIZA SEKMESİ: Orion'un md dosyaları (persona, anlık hafıza, notlar) — kart şeridi, aktif/pasif, düzenleyici. DOM katmanı.
//
// Her dosya bir kart: ● Bağlamda (Orion her turda okur) ya da ○ Kapalı. ÇİFT TIK düzenleyici penceresini açar, SAĞ TIK menü açar (Düzenle, Bağlama ekle/çıkar, kopyala),
// rozete tık aktif/pasif çevirir. Üstte özet: kaç dosya, kaç token bağlama giriyor, neyin sınıra takılıp girmediği (sessiz değil). Mantık `mind/mdBaglami.ts`te (testli);
// burası çizer. Dosyalar host'tadır (`uygulama/mdDeposu.ts`): bu sekme yalnız depoyla konuşur.
"use strict";
import type { Sekme, SekmeAraci, SekmeIcerigi } from "../../world/arayuz/altCubuk.ts";
import type { MdBilgisi, MdDeposu } from "../mdDeposu.ts";
import { ANLIK_HAFIZA, mdAdiGecerli } from "../../mind/mdBaglami.ts";

export interface HafizaSekmesiAyari {
  depo: MdDeposu;
  /** Çift tık / menü "Düzenle…": düzenleyici penceresini aç. */
  ac: (ad: string) => void;
  /** Sağ tık: dosya menüsü. */
  menuAc: (ad: string, x: number, y: number) => void;
  /** Depo yüklenemediyse nedeni (kart yerine gösterilir). */
  hata: () => string | null;
  /** Bir işlem başarısız oldu (yeni dosya, aktif çevirme): neden altyazıda. */
  bildir: (metin: string, ms?: number) => void;
}

const CSS = `
.hs-kok { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.hs-ust { display: flex; align-items: center; gap: 12px; padding: 9px 14px 4px; flex-wrap: wrap; }
.hs-ozet { color: #aab4d0; font-size: 12px; }
.hs-ozet b { color: #8fe0a8; font-weight: 600; }
.hs-uyari { color: #ffb454; font-size: 12px; }
.hs-bosluk { flex: 1; }
.hs-dugme { background: #121726; color: #d7dcea; border: 1px solid #2a3246; border-radius: 6px; padding: 3px 11px; font: inherit; cursor: pointer; }
.hs-dugme:hover { border-color: #58c1ff; }
.hs-yeni { display: flex; align-items: center; gap: 6px; }
.hs-yeni input { width: 190px; background: #121726; color: #eef1fa; border: 1px solid #2a3246; border-radius: 6px; padding: 3px 9px; font: inherit; user-select: text; }
.hs-yeni input:focus { outline: none; border-color: #58c1ff; }
.hs-yeni-hata { color: #ff8c84; font-size: 12px; }
.hs-serit { flex: 1; min-height: 0; overflow: auto; padding: 6px 14px 12px; display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); grid-auto-rows: 92px; gap: 10px; align-content: start; }
.hs-kart { position: relative; display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; background: #151c2b; border: 1px solid #222c41; border-radius: 10px; cursor: pointer; overflow: hidden; }
.hs-kart:hover { border-color: #4a69b0; background: #19223a; }
.hs-kart[data-aktif="1"] { border-color: #2f8f5a; background: #14261f; }
.hs-kart[data-aktif="1"]:hover { border-color: #46b878; }
.hs-satir { display: flex; align-items: center; gap: 8px; }
.hs-simge { font-size: 20px; line-height: 1; }
.hs-ad { font-weight: 600; color: #eef1fa; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.hs-rozet { flex: 0 0 auto; padding: 1px 9px; border-radius: 999px; font-size: 11px; border: 1px solid #2a3246; background: #0d1320; color: #7c88a6; cursor: pointer; }
.hs-rozet:hover { border-color: #58c1ff; color: #eef1fa; }
.hs-kart[data-aktif="1"] .hs-rozet { border-color: #2f8f5a; color: #8fe0a8; background: #0f1d17; }
.hs-alt { color: #6b7794; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hs-not { color: #8fb8dc; font-size: 11px; }
.hs-bos { grid-column: 1 / -1; padding: 16px 4px; color: #7c88a6; }
`;

const boyutMetni = (b: number): string => (b < 1024 ? `${b} B` : `${(b / 1024).toFixed(1)} KB`);
const zamanMetni = (t: number): string => {
  const d = new Date(t);
  return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
};
const simge = (d: MdBilgisi): string => (d.ad === ANLIK_HAFIZA ? "🧠" : /persona/i.test(d.ad) ? "🎭" : "📄");

export function hafizaSekmesi(a: HafizaSekmesiAyari): Sekme {
  return {
    id: "hafiza", ad: "Hafıza", simge: "🧠", sira: 30,
    ipucu: "Orion'un md dosyaları: persona, anlık hafıza, notlar — çift tık düzenle, sağ tık bağlama ekle/çıkar",
    kur(sayfa, arac): SekmeIcerigi { return kur(sayfa, arac, a); },
  };
}

function kur(sayfa: HTMLElement, arac: SekmeAraci, a: HafizaSekmesiAyari): SekmeIcerigi {
  const stil = document.createElement("style");
  stil.textContent = CSS;
  document.head.append(stil);
  const el = <K extends keyof HTMLElementTagNameMap>(ad: K, sinif = "", metin = ""): HTMLElementTagNameMap[K] => {
    const e = document.createElement(ad); if (sinif) e.className = sinif; if (metin) e.textContent = metin; return e;
  };

  const kok = el("div", "hs-kok");
  const ust = el("div", "hs-ust");
  const ozet = el("span", "hs-ozet");
  const uyari = el("span", "hs-uyari");
  const yeniDugme = el("button", "hs-dugme", "＋ Yeni dosya"); yeniDugme.type = "button";
  const yeniKutu = el("div", "hs-yeni"); yeniKutu.style.display = "none";
  const yeniGirdi = el("input"); yeniGirdi.placeholder = "dosya adı (örn. notlar)"; yeniGirdi.autocomplete = "off"; yeniGirdi.spellcheck = false;
  const yeniHata = el("span", "hs-yeni-hata");
  yeniKutu.append(yeniGirdi, yeniHata);
  ust.append(ozet, uyari, el("span", "hs-bosluk"), yeniKutu, yeniDugme);
  const serit = el("div", "hs-serit");
  kok.append(ust, serit);
  sayfa.append(kok);

  // ── yeni dosya ──
  const yeniKapat = () => { yeniKutu.style.display = "none"; yeniDugme.style.display = ""; yeniGirdi.value = ""; yeniHata.textContent = ""; };
  yeniDugme.addEventListener("click", () => { yeniDugme.style.display = "none"; yeniKutu.style.display = "flex"; yeniGirdi.focus(); yeniDugme.blur(); });
  yeniGirdi.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.stopPropagation(); yeniKapat(); return; }
    if (e.key !== "Enter") return;
    e.preventDefault();
    const ham = yeniGirdi.value.trim();
    const ad = ham.toLowerCase().endsWith(".md") ? ham : `${ham}.md`;
    if (!ham) { yeniHata.textContent = "bir ad yaz"; return; }
    if (!mdAdiGecerli(ad)) { yeniHata.textContent = "geçersiz ad (harf, rakam, boşluk, - _ . kullan)"; return; }
    if (a.depo.liste().some((d) => d.ad === ad)) { yeniHata.textContent = "bu ad zaten var"; return; }
    void a.depo.yeni(ad, `# ${ad.replace(/\.md$/, "")}\n\n`).then(() => { yeniKapat(); a.ac(ad); }, (err: unknown) => { yeniHata.textContent = err instanceof Error ? err.message : String(err); });
  });

  // ── kartlar ──
  function kart(d: MdBilgisi): HTMLElement {
    const k = el("div", "hs-kart");
    k.dataset.ad = d.ad; k.dataset.aktif = d.aktif ? "1" : "0";
    k.title = `${d.ad}\nÇift tık: düzenle · Sağ tık: menü · Rozet: bağlama ekle/çıkar`;
    const satir = el("div", "hs-satir");
    const rozet = el("button", "hs-rozet", d.aktif ? "● Bağlamda" : "○ Kapalı"); rozet.type = "button";
    rozet.title = d.aktif ? "Orion her turda bu dosyayı okuyor — tıkla: çıkar" : "Orion bu dosyayı okumuyor — tıkla: bağlama ekle";
    rozet.addEventListener("click", (e) => {
      e.stopPropagation(); rozet.blur();
      void a.depo.aktifYap(d.ad, !d.aktif).catch((err: unknown) => a.bildir(`${d.ad}: ${err instanceof Error ? err.message : String(err)}`, 5000));
    });
    rozet.addEventListener("dblclick", (e) => e.stopPropagation());
    satir.append(el("span", "hs-simge", simge(d)), el("span", "hs-ad", d.ad), rozet);
    k.append(satir, el("div", "hs-alt", `${boyutMetni(d.boyut)} · ${zamanMetni(d.degisti)}`));
    if (d.sistem) k.append(el("div", "hs-not", "otomatik güncellenir (konum, son iş, son konuşma)"));
    k.addEventListener("dblclick", () => a.ac(d.ad));
    k.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); a.menuAc(d.ad, e.clientX, e.clientY); });
    return k;
  }

  function ciz(): void {
    const liste = a.depo.liste();
    const baglam = a.depo.baglam();
    const aktifler = liste.filter((d) => d.aktif).length;
    arac.rozet(aktifler ? String(aktifler) : null);
    ozet.replaceChildren();
    if (liste.length) {
      ozet.append(`${liste.length} dosya · `, Object.assign(el("b"), { textContent: `${baglam.kullanilan.length} bağlamda` }), ` · ≈${baglam.tahminiToken} token her turda`);
    }
    const sigmayan = baglam.atlanan.filter((x) => x.neden !== "boş");
    const kesilen = baglam.kullanilan.filter((x) => x.kesildi);
    uyari.textContent = [
      ...sigmayan.map((x) => `⚠ ${x.ad}: ${x.neden}`),
      ...kesilen.map((x) => `✂ ${x.ad}: uzun, kesilerek giriyor`),
    ].join(" · ");
    uyari.title = "Bağlama giren metin sınırlıdır (token ve dikkat maliyeti). Dosyayı kısalt ya da başka bir dosyayı kapat.";
    arac.ipucu("Çift tık: düzenle · Sağ tık: bağlama ekle/çıkar, kopyala · Rozete tık: aktif/pasif");
    if (!liste.length) {
      const h = a.hata();
      serit.replaceChildren(el("div", "hs-bos", h ? `Dosyalar yüklenemedi: ${h}` : "Henüz dosya yok. ＋ Yeni dosya ile başla."));
      return;
    }
    serit.replaceChildren(...liste.map(kart));
  }

  // Abonelik sekme ömrü boyunca açık kalır: liste/aktiflik değişince rozet (aktif sayısı) çubuk kapalıyken de doğru kalır.
  a.depo.dinle((o) => { if (o.tur === "liste") ciz(); });
  return { goster: ciz };
}
