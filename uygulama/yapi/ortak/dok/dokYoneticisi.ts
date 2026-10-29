// uygulama/yapi/ortak/dok/dokYoneticisi.ts — DOK SİSTEMİNİN DOM KATMANI (spec 39 D3): sol · sağ · alt bölgeler (sekmeli) ve yüzer pencereler, sürükle-bırak.
//
// KURAL `dokDuzeni.ts`te (saf, testli): hangi panel hangi bölgeye bırakılabilir, kapat/aç, boyut sınırı, kalıcılık. Burası yalnız çizer ve olayı modele iletir; model
// REDDEDERSE nedeni ekranda gösterilir (sessiz yutma yok). Panelin İÇERİĞİ sahibinin DOM öğesidir: bölgeler arasında TAŞINIR (kopyalanmaz), görünmeyenler gizli depoda tutulur.
//
// SAHNE DOKUN ALTINDA KALMASIN: bir bölgede görünür panel varsa `--dok-sol|sag|alt` (px) yazılır, yoksa kalkar; `index.html` tuvali bunlardan düşer ve tuvalin
// ResizeObserver'ı motoru boyutlar (giris.ts). Alt bölge Yapı çubuğunun / sekans editörünün payının ÜSTÜNDE oturur (dokStili.ts).
// SÜRÜKLEME SIRASINDA YENİDEN ÇİZİLMEZ: kaynak sekme DOM'dan giderse tarayıcı `dragend`i hiç göndermez; bekleyen çizim bırakınca yapılır.
// KALICILIK: `localStorage` (anahtar çağıranın). Spec 39 D3 `Saved/dok.json` der; ana süreç kanalı eklenene kadar tarayıcı deposu (depo yoksa her açılışta varsayılan).
// TUŞLAR OYUNA SIZMAZ: dok kökü keydown/keyup/keypress'i bitirir (paneldeki yazı alanları eskiden editör kökünün içindeydi).
"use strict";
import { el } from "../dom.ts";
import type { MenuSatiri } from "../menuModeli.ts";
import { AYIRICI } from "../menuModeli.ts";
import { BOLGELER, KENAR_BOLGELER, ac as acModel, boyutAyarla, etkinYap, kapat as kapatModel, oku, panelBolgesi, serilestir, tasi as tasiModel, varsayilanDuzen, yuzerKonumla, YUZER_VARSAYILAN } from "./dokDuzeni.ts";
import type { Bolge, Duzen, KenarBolge, PanelKaydi, Sonuc, YuzerKonum } from "./dokDuzeni.ts";
import { dokStiliEkle } from "./dokStili.ts";

export interface DokPaneli {
  kayit: PanelKaydi;
  icerik: HTMLElement;
  /** Sahibi için şu an anlamlı mı (ör. editör açık). Varsayılan true. Görünmeyen panel sekme/bölge açmaz. */
  gorunur?: boolean;
  ipucu?: string;
  /** Sekme başlığındaki simge (emoji ya da 1–2 karakter). */
  simge?: string;
  /** Panel ekranda göründüğünde (etkin sekme ya da yüzer pencere) — içeriği tembel kurmak için. */
  goster?(): void;
  /** Panel ekrandan gittiğinde (sekme değişti, bölge kapandı, imleç kipi kapandı). */
  gizle?(): void;
}

export interface DokYoneticisi {
  readonly kok: HTMLElement;
  kaydet(p: DokPaneli): void;
  gorunur(id: string, g: boolean): void;
  /** Kapalıysa açar, açıksa etkin sekme yapar. */
  sec(id: string): void;
  /** Sekme başlığındaki işaret (ör. "●"). */
  rozet(id: string, metin: string): void;
  /** Etkin sekmenin yanında, şeridin sağında tek satır bağlam ipucu ("sol tık seç · Esc çık"). Panel etkin değilse yazılır, görünmez. */
  bilgi(id: string, metin: string): void;
  /** Bütün panelleri gizle/göster (Y). Düzen ve kayıt değişmez. */
  tumunuGoster(g: boolean): void;
  /** İmleç kipi açık mı: fare serbestken panel bölgeleri tıklanabilir ve görünür (kapalıyken oyun alanını daraltmaz). */
  kipGorunur(g: boolean): void;
  /** Panellerin ŞU AN görünür olup olmadığı (imleç kipi açık VE gizlenmemiş). */
  gorunurMu(): boolean;
  /** Y ile gizlenmemiş mi (imleç kipinden bağımsız). */
  acikMi(): boolean;
  duzen(): Duzen;
  tasi(id: string, bolge: Bolge, sira?: number): Sonuc;
  kapat(id: string): void;
  /** Yüzer panelin konum/boyutunu ayarlar (yüzer değilse sessizce yok sayılır). İlk açılışta uygun boyut vermek için (ör. önizleme penceresi geniş açılır). */
  yuzerAyarla(id: string, k: Partial<YuzerKonum>): void;
  sifirla(): void;
  /** Panelin ekranda gerçekten görünmesi: görünür + kapalı değil + (kenar bölgesinde) etkin sekme. */
  ekrandaMi(id: string): boolean;
  iceriyor(n: Node | null): boolean;
  /** "Pencere" menüsüne satırlar (kayıtlı her panel işaretli/işaretsiz + sıfırla). */
  menuSatirlari(): MenuSatiri[];
}

const IPUCU_MS = 4000;

export function dokYoneticisiKur(anahtar: string): DokYoneticisi {
  dokStiliEkle();
  const kok = el("div", "dk-kok"); kok.dataset.surukle = "0";
  const depo = el("div", "dk-depo");
  const ipucuKutusu = el("div", "dk-ipucu"); ipucuKutusu.setAttribute("role", "status");
  const bolgeler = {} as Record<KenarBolge, { kok: HTMLElement; serit: HTMLElement; icerik: HTMLElement }>;
  const hedefler = {} as Record<Bolge, HTMLElement>;
  const yuzerler = new Map<string, HTMLElement>();
  kok.append(depo, ipucuKutusu);

  const kayitlar: PanelKaydi[] = [];
  const paneller = new Map<string, { p: DokPaneli; rozet: string; gorunur: boolean; bilgi: string }>();
  const ham = (() => { try { return localStorage.getItem(anahtar); } catch { return null; } })();
  let duzen: Duzen = varsayilanDuzen([]);
  let degisti = false;   // kullanıcı bu oturumda düzeni değiştirdi mi (sonradan kaydolan panel için kayıtlı metin mi yoksa canlı düzen mi okunur)
  let surukle: string | null = null, cizimBekliyor = false;
  let ipucuZamani: ReturnType<typeof setTimeout> | undefined;
  // Görünürlük iki kapılı: imleç kipi (fare serbest değilken panel tıklanamaz, oyun alanı daralmaz) VE Y ile gizlenmemiş olmalı.
  let kipAcik = false, tumuAcik = true;
  let canli = new Set<string>();   // ekranda şu an görünen paneller (goster/gizle geçişleri için)
  const acikOrtam = (): boolean => kipAcik && tumuAcik;

  const kaydetDepo = (): void => { try { localStorage.setItem(anahtar, serilestir(duzen)); } catch { /* depo yok: yalnız bu açılış */ } };
  const gorunenler = (b: Bolge): string[] => acikOrtam() ? duzen.gruplar[b].filter((id) => paneller.get(id)?.gorunur) : [];
  const etkinOf = (b: KenarBolge): string | null => { const g = gorunenler(b); return duzen.etkin[b] && g.includes(duzen.etkin[b]!) ? duzen.etkin[b] : (g[0] ?? null); };
  const ad = (id: string): string => paneller.get(id)?.p.kayit.ad ?? id;

  function ipucu(metin: string): void {
    ipucuKutusu.textContent = metin; ipucuKutusu.dataset.acik = "1";
    clearTimeout(ipucuZamani); ipucuZamani = setTimeout(() => { ipucuKutusu.dataset.acik = "0"; }, IPUCU_MS);
  }

  /** Bölgenin payını sahneye yazar: sol/sağ/alt için `--dok-*`; alt bölge ayrıca `--alt-cubuk` (altyazı, sohbet ve sahnenin alt payı bundan okur). `null` = bölge kapalı. */
  function boyutuYay(b: KenarBolge, px: number | null): void {
    const s = document.documentElement.style;
    if (px === null) { s.removeProperty(`--dok-${b}`); if (b === "alt") s.removeProperty("--alt-cubuk"); return; }
    s.setProperty(`--dok-${b}`, `${px}px`);
    if (b === "alt") s.setProperty("--alt-cubuk", `${px}px`);
  }

  // ── çizim ──
  function ciz(): void {
    if (surukle) { cizimBekliyor = true; return; }
    cizimBekliyor = false;
    const kullanilan = new Set<string>();
    for (const b of KENAR_BOLGELER) {
      const r = bolgeler[b], ids = gorunenler(b), etkin = etkinOf(b);
      r.kok.dataset.acik = ids.length ? "1" : "0";
      if (ids.length) boyutuYay(b, duzen.boyut[b]);
      else boyutuYay(b, null);
      const kapatDugme = el("button", "dk-ikon", "✕"); kapatDugme.type = "button"; kapatDugme.title = "Etkin paneli kapat (Pencere menüsünden geri açılır)";
      kapatDugme.addEventListener("click", () => { kapatDugme.blur(); const e = etkinOf(b); if (e) kapat(e); });
      const bilgi = el("span", "dk-bilgi", etkin ? (paneller.get(etkin)?.bilgi ?? "") : "");
      r.serit.replaceChildren(...ids.map((id) => sekmeYap(id, id === etkin)), el("span", "dk-bosluk"), bilgi, kapatDugme);
      for (const id of ids) {
        const ic = paneller.get(id)!.p.icerik;
        ic.dataset.dok = "1"; ic.dataset.etkin = id === etkin ? "1" : "0"; kullanilan.add(id);
        if (ic.parentElement !== r.icerik) r.icerik.append(ic);
      }
    }
    // Yüzer pencereler: görünür olanlar pencere, kalanlar kaldırılır
    const yuzerIds = gorunenler("yuzer");
    for (const [id, w] of yuzerler) if (!yuzerIds.includes(id)) { w.remove(); yuzerler.delete(id); }
    for (const id of yuzerIds) {
      const w = yuzerler.get(id) ?? yuzerPenceresi(id);
      const k = duzen.yuzerKonum[id] ?? YUZER_VARSAYILAN;
      w.style.left = `${k.x}px`; w.style.top = `${k.y}px`;
      if (w.offsetWidth !== k.g) w.style.width = `${k.g}px`;
      if (w.offsetHeight !== k.yuk) w.style.height = `${k.yuk}px`;
      const ic = paneller.get(id)!.p.icerik, govde = w.querySelector<HTMLElement>(".dk-yuzer-icerik")!;
      ic.dataset.dok = "1"; ic.dataset.etkin = "1"; kullanilan.add(id);
      if (ic.parentElement !== govde) govde.append(ic);
    }
    for (const [id, v] of paneller) if (!kullanilan.has(id) && v.p.icerik.parentElement !== depo) depo.append(v.p.icerik);   // kapalı/görünmeyen: gizli depo
    // Boş bölgelerin sürükleme hedefi kenar şeridi olarak görünür
    for (const b of KENAR_BOLGELER) hedefler[b].dataset.var = gorunenler(b).length === 0 ? "1" : "0";
    // Ekranda görünenler: her kenarda yalnız ETKİN sekme (içeriği görünür), yüzerlerin hepsi. Geçişte callback'ler bir kez çağrılır.
    const simdi = new Set<string>();
    for (const b of KENAR_BOLGELER) { const e = etkinOf(b); if (e) simdi.add(e); }
    for (const id of yuzerIds) simdi.add(id);
    const giden = [...canli].filter((id) => !simdi.has(id)), gelen = [...simdi].filter((id) => !canli.has(id));
    canli = simdi;   // önce yaz: callback içinde ciz() çağrılırsa geçişler yinelenmez
    for (const id of giden) paneller.get(id)?.p.gizle?.();
    for (const id of gelen) paneller.get(id)?.p.goster?.();
  }

  function sekmeYap(id: string, etkin: boolean): HTMLButtonElement {
    const s = el("button", "dk-sekme"); s.type = "button"; s.draggable = true; s.dataset.panel = id; s.dataset.etkin = etkin ? "1" : "0";
    const p = paneller.get(id);
    if (p?.p.simge) s.append(el("span", "dk-simge", p.p.simge));
    s.append(ad(id));
    if (p?.rozet) s.append(el("span", "dk-rozet", p.rozet));
    s.title = `${p?.p.ipucu ?? ad(id)} — sürükleyip başka bölgeye bırak`;
    s.addEventListener("click", () => { s.blur(); duzen = etkinYap(duzen, id); kaydetDepo(); ciz(); });
    s.addEventListener("dragstart", (e) => {
      surukle = id; s.dataset.surukleniyor = "1";
      e.dataTransfer?.setData("text/plain", `orion-dok:${id}`);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
      surukleBasla(id);
    });
    s.addEventListener("dragend", () => surukleBitir());
    return s;
  }

  function yuzerPenceresi(id: string): HTMLElement {
    const w = el("div", "dk-yuzer"); w.dataset.panel = id;
    const bas = el("div", "dk-yuzer-bas"), baslik = el("span", "dk-yuzer-ad", ad(id));
    const yerlestir = el("button", "dk-ikon", "⇲"); yerlestir.type = "button"; yerlestir.title = "Dok bölgesine yerleştir";
    const kapatD = el("button", "dk-ikon", "✕"); kapatD.type = "button"; kapatD.title = "Kapat";
    bas.append(baslik, yerlestir, kapatD);
    const govde = el("div", "dk-yuzer-icerik");
    w.append(bas, govde);
    kapatD.addEventListener("click", () => kapat(id));
    yerlestir.addEventListener("click", () => {
      const k = paneller.get(id)!.p.kayit;
      const b = k.varsayilan !== "yuzer" ? k.varsayilan : (k.bolgeler.find((x) => x !== "yuzer") ?? null);
      if (!b) { ipucu(`${k.ad} paneli yalnız yüzer olabilir`); return; }
      tasi(id, b);
    });
    // Başlıktan sürükle: pencere taşınır, bırakınca konum kaydolur
    bas.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
      e.preventDefault(); try { bas.setPointerCapture(e.pointerId); } catch { /* etkin olmayan işaretçi (sentetik olay): dinleyiciler öğenin kendisinde */ }
      const x0 = e.clientX - w.offsetLeft, y0 = e.clientY - w.offsetTop;
      const hareket = (m: PointerEvent): void => {
        w.style.left = `${Math.max(80 - w.offsetWidth, Math.min(innerWidth - 80, m.clientX - x0))}px`;
        w.style.top = `${Math.max(0, Math.min(innerHeight - 40, m.clientY - y0))}px`;
      };
      const bitir = (): void => {
        bas.removeEventListener("pointermove", hareket); bas.removeEventListener("pointerup", bitir); bas.removeEventListener("pointercancel", bitir);
        duzen = yuzerKonumla(duzen, id, { x: w.offsetLeft, y: w.offsetTop }); degisti = true; kaydetDepo();
      };
      bas.addEventListener("pointermove", hareket); bas.addEventListener("pointerup", bitir); bas.addEventListener("pointercancel", bitir);
    });
    // CSS `resize: both` boyutu değiştirince modele yaz (kısa bekleme: sürükleme boyunca tek kayıt)
    let sayac: ReturnType<typeof setTimeout> | undefined;
    new ResizeObserver(() => {
      clearTimeout(sayac);
      sayac = setTimeout(() => {
        const k = duzen.yuzerKonum[id];
        if (!k || !w.isConnected || (w.offsetWidth === k.g && w.offsetHeight === k.yuk)) return;
        duzen = yuzerKonumla(duzen, id, { g: w.offsetWidth, yuk: w.offsetHeight }); degisti = true; kaydetDepo();
      }, 250);
    }).observe(w);
    kok.append(w); yuzerler.set(id, w);
    return w;
  }

  // ── sürükle-bırak ──
  function surukleBasla(id: string): void {
    const k = paneller.get(id)?.p.kayit; if (!k) return;
    kok.dataset.surukle = "1";
    for (const b of BOLGELER) hedefler[b].dataset.izinli = k.bolgeler.includes(b) ? "1" : "0";
    hedefler.yuzer.dataset.var = "1";
  }
  function surukleBitir(): void {
    surukle = null; kok.dataset.surukle = "0";
    for (const b of BOLGELER) { hedefler[b].dataset.ustunde = "0"; }
    for (const b of KENAR_BOLGELER) bolgeler[b].kok.dataset.hedef = "0";
    document.querySelectorAll<HTMLElement>(".dk-sekme[data-surukleniyor]").forEach((s) => { s.dataset.surukleniyor = "0"; });
    if (cizimBekliyor) ciz();
  }
  /** Bırakma noktasına göre grup içindeki sıra: sekmenin SOLUNDA bırakılırsa onun yerine, sağında bırakılırsa sonrasına. Sekme yoksa sona. */
  function siraBul(b: KenarBolge, x: number | null): number | undefined {
    if (x === null) return undefined;
    const sekmeler = [...bolgeler[b].serit.querySelectorAll<HTMLElement>(".dk-sekme")];
    for (const s of sekmeler) {
      const r = s.getBoundingClientRect();
      if (x < r.left + r.width / 2) { const i = duzen.gruplar[b].indexOf(s.dataset.panel ?? ""); return i < 0 ? undefined : i; }
    }
    const son = sekmeler[sekmeler.length - 1];
    if (!son) return undefined;
    const i = duzen.gruplar[b].indexOf(son.dataset.panel ?? "");
    return i < 0 ? undefined : i + 1;
  }
  function birak(b: Bolge, x: number | null, y: number | null): void {
    const id = surukle; if (!id) return;
    let sira = b === "yuzer" ? undefined : siraBul(b, x);
    const eski = duzen.gruplar[b].indexOf(id);
    if (sira !== undefined && eski >= 0 && eski < sira) sira -= 1;   // önce çıkarılacak: sonrasındaki yerler bir kayar
    surukle = null;   // ciz() artık bekletmesin
    const s = tasi(id, b, sira);
    if (s.ok && b === "yuzer" && x !== null && y !== null) { duzen = yuzerKonumla(duzen, id, { x: x - 120, y: Math.max(0, y - 14) }); kaydetDepo(); ciz(); }
    surukleBitir();
  }
  function hedefBagla(e: HTMLElement, b: Bolge, bolgeKutusu: HTMLElement | null, xAl: boolean): void {
    e.addEventListener("dragover", (o) => {
      if (!surukle) return;
      o.preventDefault(); if (o.dataTransfer) o.dataTransfer.dropEffect = "move";
      if (bolgeKutusu) bolgeKutusu.dataset.hedef = "1"; else e.dataset.ustunde = "1";
    });
    e.addEventListener("dragleave", () => { if (bolgeKutusu) bolgeKutusu.dataset.hedef = "0"; else e.dataset.ustunde = "0"; });
    e.addEventListener("drop", (o) => { if (!surukle) return; o.preventDefault(); birak(b, xAl ? o.clientX : null, o.clientY); });
  }

  // ── bölge kabukları ──
  for (const b of KENAR_BOLGELER) {
    const r = el("div", "dk-bolge"); r.dataset.bolge = b; r.dataset.acik = "0";
    const serit = el("div", "dk-seritler"), icerik = el("div", "dk-icerik"), tutamak = el("div", "dk-tutamak");
    tutamak.title = "Sürükle: boyutu değiştir";
    r.append(serit, icerik, tutamak);
    bolgeler[b] = { kok: r, serit, icerik };
    hedefBagla(serit, b, r, true); hedefBagla(icerik, b, r, false);
    tutamak.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault(); tutamak.dataset.surukle = "1"; try { tutamak.setPointerCapture(e.pointerId); } catch { /* sentetik olay: dinleyiciler öğenin kendisinde */ }
      const hareket = (m: PointerEvent): void => {
        const kutu = r.getBoundingClientRect();
        duzen = boyutAyarla(duzen, b, b === "sol" ? m.clientX : b === "sag" ? innerWidth - m.clientX : kutu.bottom - m.clientY);
        boyutuYay(b, duzen.boyut[b]);
      };
      const bitir = (): void => {
        tutamak.dataset.surukle = "0"; tutamak.removeEventListener("pointermove", hareket); tutamak.removeEventListener("pointerup", bitir); tutamak.removeEventListener("pointercancel", bitir);
        degisti = true; kaydetDepo();
      };
      tutamak.addEventListener("pointermove", hareket); tutamak.addEventListener("pointerup", bitir); tutamak.addEventListener("pointercancel", bitir);
    });
    kok.append(r);
  }
  for (const b of BOLGELER) {
    const h = el("div", "dk-hedef", b === "yuzer" ? "Yüzer pencere" : `${b === "sol" ? "Sol" : b === "sag" ? "Sağ" : "Alt"} bölge`);
    h.dataset.bolge = b; h.dataset.var = "0"; h.dataset.izinli = "1"; h.dataset.ustunde = "0";
    hedefBagla(h, b, null, true);
    hedefler[b] = h; kok.append(h);
  }

  // Esc paneli kapatan pencerelere (model seçici, stil, gözlem) ulaşır; diğer tuşlar oyuna sızmaz. Odaktaki düğme de tuşu yutmasın diye Esc geçer.
  kok.addEventListener("keydown", (e) => { if (e.key !== "Escape") e.stopPropagation(); });
  kok.addEventListener("keyup", (e) => e.stopPropagation());
  kok.addEventListener("keypress", (e) => e.stopPropagation());
  document.body.append(kok);

  // ── işlemler ──
  function tasi(id: string, b: Bolge, sira?: number): Sonuc {
    const s = tasiModel(duzen, kayitlar, id, b, sira);
    if (!s.ok) { ipucu(s.neden); return s; }
    duzen = s.duzen; degisti = true; kaydetDepo(); ciz();
    return s;
  }
  function kapat(id: string): void { duzen = kapatModel(duzen, id); degisti = true; kaydetDepo(); ciz(); }
  const acikMi = (id: string): boolean => !duzen.kapali.includes(id) && panelBolgesi(duzen, id) !== null;
  function sec(id: string): void {
    if (!paneller.has(id)) return;
    const s = acModel(duzen, kayitlar, id);
    if (!s.ok) { ipucu(s.neden); return; }
    duzen = etkinYap(s.duzen, id); degisti = true; kaydetDepo(); ciz();
  }
  function yuzerAyarla(id: string, k: Partial<YuzerKonum>): void {
    const yeni = yuzerKonumla(duzen, id, k);
    if (yeni === duzen) return;
    duzen = yeni; degisti = true; kaydetDepo(); ciz();
  }
  function sifirla(): void { duzen = varsayilanDuzen(kayitlar); degisti = true; kaydetDepo(); ciz(); }

  return {
    kok,
    kaydet(p) {
      if (paneller.has(p.kayit.id)) throw new Error(`dok paneli zaten kayıtlı: ${p.kayit.id}`);
      kayitlar.push(p.kayit); paneller.set(p.kayit.id, { p, rozet: "", gorunur: p.gorunur ?? true, bilgi: "" });
      duzen = oku(degisti ? serilestir(duzen) : ham, kayitlar);
      p.icerik.dataset.dok = "1"; depo.append(p.icerik);
      ciz();
    },
    gorunur(id, g) { const v = paneller.get(id); if (!v || v.gorunur === g) return; v.gorunur = g; ciz(); },
    sec,
    rozet(id, metin) { const v = paneller.get(id); if (!v || v.rozet === metin) return; v.rozet = metin; ciz(); },
    duzen: () => duzen,
    tasi,
    kapat,
    yuzerAyarla,
    sifirla,
    ekrandaMi(id) {
      const v = paneller.get(id), b = panelBolgesi(duzen, id);
      if (!v || !v.gorunur || !b || duzen.kapali.includes(id) || !acikOrtam()) return false;
      return b === "yuzer" || etkinOf(b) === id;
    },
    bilgi(id, metin) { const v = paneller.get(id); if (!v || v.bilgi === metin) return; v.bilgi = metin; ciz(); },
    tumunuGoster(g) { if (tumuAcik === g) return; tumuAcik = g; ciz(); },
    kipGorunur(g) { if (kipAcik === g) return; kipAcik = g; ciz(); },
    gorunurMu: acikOrtam,
    acikMi: () => tumuAcik,
    iceriyor: (n) => !!n && kok.contains(n),
    menuSatirlari() {
      const satirlar: MenuSatiri[] = kayitlar.map((k): MenuSatiri => ({
        etiket: k.ad, ipucu: paneller.get(k.id)?.p.ipucu,
        etkin: () => paneller.get(k.id)?.gorunur === true,
        isaretli: () => acikMi(k.id),
        calistir: () => { if (acikMi(k.id)) kapat(k.id); else sec(k.id); },
      }));
      return [...satirlar, AYIRICI, { etiket: "Dok düzenini sıfırla", ipucu: "Bütün panelleri varsayılan bölgelerine döndürür", calistir: sifirla }];
    },
  };
}
