// world/arayuz/stilPenceresi.ts — Ova'daki stil deneme araçlarını (stil önayarı, renk düzeni, ışık sonrası çipleri,
// özel shader'lar, saat/dünya) oyunun İÇİNDE açılıp kapanan, sürüklenebilir bir pencere yapar (G tuşu).
//
// NEDEN: bu düğmeler yalnız level editörü sayfasında (editor.html / ova-deneme.html) vardı; Ozyn kapıdan çıkıp
// ovayı oyuncu gözüyle görürken stili denemek için sayfa değiştirmek zorundaydı. Panelin kendisi editörünkiyle
// AYNI kod (`level/editor/arayuz/gorunum.ts`); kaynak soyut olduğu için burada geri-al/kirli işareti yok ve
// değişiklikler yalnız bu oturumdaki canlı level'a yazılır, DOSYAYA yazılmaz (ova.level.json'a dokunulmaz).
//
// Ömür: ova kurulunca `ova(level)` pencereyi ona bağlar, ofise dönünce `ova(null)` kapatıp söker (level yıkılır,
// düğmeler ölü level'a bakmasın). Pencere kapalıyken oyun klavyesine dokunmaz; açıkken tuşlar oda dinleyicilerine
// SIZMAZ (süzgeçteki "t" sohbeti açmasın), Esc ve G kapatır.
"use strict";
import type { Level } from "../level/cekirdek/levelKur.ts";
import { SHADERLAR } from "../level/shader/moduller/index.ts";
import { gorunumKur, type GorunumKaynagi } from "../level/editor/arayuz/gorunum.ts";
import type { OrtamKomutu } from "../level/stil/ortamKomutu.ts";

// `world/` uygulama/ katmanını import etmez (K4): pencerenin ihtiyacı olan yüzey burada TANIMLI, uygulama/ortamBaglantisi
// ve uygulama/ortamDeposu bunu yapısal olarak sağlar (kompozisyon kökü bağlar).
/** Ortam komutu yolu: düğmeler komutu uygular, değişiklikler (Orion'unkiler dahil) `dinle` ile duyulur. */
export interface PencereOrtami {
  uygula(k: OrtamKomutu): { ok: boolean; not: string };
  dinle(f: () => void): () => void;
}
/** Orion'un LLM'den öğrendiği sözler (mind/ortamSozlugu.ts): Ozyn görür ve siler. */
export interface PencereOgrenilen {
  liste(): { soz: string; ham: string; ozet: string; askida: boolean }[];
  sil(soz: string): void;
}
/** Hatırlama kipi (oturum | kalıcı). */
export interface PencereGunlugu {
  readonly kip: "oturum" | "kalici";
  kipAyarla(kip: "oturum" | "kalici"): void;
}
import { el, cssKur, cssEkle } from "../level/editor/arayuz/ortak.ts";

const CSS = `
#stil-pencere { position: fixed; right: 16px; top: 64px; width: 420px; max-width: calc(100vw - 32px); max-height: calc(100vh - 96px);
  background: var(--ed-zemin); border: 1px solid var(--ed-cizgi); border-radius: 8px; z-index: 40; display: none; flex-direction: column;
  overflow: hidden; }
#stil-pencere.acik { display: flex; }
#stil-pencere .bas { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-bottom: 1px solid var(--ed-cizgi); cursor: move;
  user-select: none; }
#stil-pencere .bas b { flex: 1; font-size: 12px; }
#stil-pencere .bas small { color: var(--ed-soluk); }
#stil-pencere .govde { overflow: auto; min-height: 0; }
#stil-pencere .not { padding: 6px 8px; color: var(--ed-soluk); font-size: 11px; border-top: 1px solid var(--ed-cizgi); }
#stil-pencere .alt { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-top: 1px solid var(--ed-cizgi); font-size: 11px; }
#stil-pencere .alt label { flex: 1; cursor: pointer; }
#stil-pencere .ogr { padding: 4px 8px; border-top: 1px solid var(--ed-cizgi); font-size: 11px; max-height: 120px; overflow: auto; }
#stil-pencere .ogr summary { cursor: pointer; color: var(--ed-soluk); }
#stil-pencere .ogr .s { display: flex; gap: 6px; align-items: center; padding: 2px 0; }
#stil-pencere .ogr .s span { flex: 1; }
#stil-pencere .ogr .s.askida span { opacity: .55; text-decoration: line-through; }
`;

export interface StilPenceresi {
  /** Ova kurulunca level verilir, ofise dönünce null (pencere kapanır ve sökülür). */
  ova(level: Level | null): void;
  ac(): void;
  kapat(): void;
  acikMi(): boolean;
}

export interface StilPenceresiAyari {
  /** G şu an bir harf mi: terminal/sohbet/onay açıkken değil (kompozisyon kökü bilir). */
  tusSerbest?: () => boolean;
  /** Pencere açılınca (fare kilidini bırakmak gibi). */
  acildi?: () => void;
  /**
   * Orion'un `ortam` aracıyla AYNI bağlantı: düğmeler komut olarak buradan geçer (elle yapılan da günlüğe girer, Orion'un
   * yaptığı da düğme durumuna yansır). Verilmezse düğmeler level'ı doğrudan yamar (eski davranış, günlük yok).
   */
  ortam?: PencereOrtami;
  /** Hatırlama kipi: verilirse altta "ayarları hatırla" kutusu ve "varsayılana dön" düğmesi çıkar. */
  gunluk?: PencereGunlugu;
  /** Öğrenilen sözler: verilirse altta "öğrendiklerim" listesi (her biri silinebilir). */
  ogrenilen?: PencereOgrenilen;
}

/** Canlı level'ı panelin soyut kaynağına bağlar: geçmiş yok, hata sessiz değil (konsola düşer, eski hâl kalır). */
export function levelKaynagi(level: Level, baglanti?: PencereOrtami): GorunumKaynagi & { dinleyicileriBosalt(): void } {
  let dinleyiciler: (() => void)[] = [];
  const yay = () => { for (const f of dinleyiciler) f(); };
  // Orion'un (ya da sözlüğün) yaptığı değişiklik düğme durumuna da yansısın.
  const birak = baglanti?.dinle(() => yay());
  const uygula = (t: unknown): boolean => {
    try { level.ayarla(t); return true; } catch (err) { console.error("[STIL] uygulanamadı:", err); return false; }
  };
  return {
    tanim: () => level.tanim(),
    degistir: (f, mesaj) => {
      let yeni;
      try { yeni = f(structuredClone(level.tanim())); } catch (err) { console.error("[STIL]", mesaj, err); return false; }
      if (!uygula(yeni)) return false;
      console.log(`[STIL] ${mesaj}`);
      yay();
      return true;
    },
    onizle: (t) => { uygula(t); },
    hal: () => null,
    abone: (f) => { dinleyiciler.push(f); },
    saat: () => level.dunya.saat,
    ...(baglanti ? { komut: (k: Parameters<NonNullable<GorunumKaynagi["komut"]>>[0]) => {
      const r = baglanti.uygula(k);
      if (!r.ok) console.error(`[STIL] ${k.ne} ${k.deger ?? k.sayi ?? ""}: ${r.not}`);
      else console.log(`[STIL] ${r.not}`);
      return r.ok;
    } } : {}),
    dinleyicileriBosalt: () => { dinleyiciler = []; birak?.(); },
  };
}

export function stilPenceresiKur(ayar: StilPenceresiAyari = {}): StilPenceresi {
  cssKur();
  cssEkle("stilPencereStil", CSS);
  const kok = el("div", "ed-kok"); kok.id = "stil-pencere";
  const bas = el("div", "bas");
  const baslik = el("b", "", "Ova — stil deneme");
  const ipucu = el("small", "", "G");
  const kapatDugme = el("button", "", "×"); kapatDugme.title = "Kapat (G ya da Esc)";
  bas.append(baslik, ipucu, kapatDugme);
  const govde = el("div", "govde");
  const not = el("div", "not", "Değişiklikler ova.level.json'a yazılmaz. Orion da bu ayarları değiştirebilir (\"gece yap\", \"ışığı kıs\"). Dosyaya yazmak için editör sayfası (ova-deneme.html).");
  kok.append(bas, govde);
  if (ayar.gunluk) {
    const g = ayar.gunluk;
    const alt = el("div", "alt");
    const kutu = el("input"); kutu.type = "checkbox"; kutu.id = "stil-hatirla"; kutu.checked = g.kip === "kalici";
    kutu.onchange = () => { g.kipAyarla(kutu.checked ? "kalici" : "oturum"); };
    const etiket = el("label", "", "ayarları hatırla (sonraki açılışta da)"); etiket.htmlFor = "stil-hatirla";
    etiket.title = "Kapalıyken ayarlar yalnız bu açılışta kalır; açıkken tarayıcıda saklanır ve ova ayarlarla gelir.";
    const sifirla = el("button", "", "varsayılana dön"); sifirla.title = "Ova açılıştaki hâline döner, hatırlanan ayarlar silinir";
    sifirla.onclick = () => { ayar.ortam?.uygula({ tur: "ortam", ne: "sifirla" }); sifirla.blur(); };
    alt.append(kutu, etiket, sifirla);
    kok.append(alt);
  }
  let ogrenilenCiz: () => void = () => {};
  let ogrKutu: HTMLDetailsElement | null = null;
  const ogrCiz = () => {
    if (!ogrKutu || !ayar.ogrenilen) return;
    const liste = ayar.ogrenilen.liste();
    ogrKutu.querySelector("summary")!.textContent = `öğrendiklerim (${liste.length})`;
    ogrKutu.querySelectorAll(".s").forEach((e) => e.remove());
    for (const k of liste) {
      const s = el("div", `s${k.askida ? " askida" : ""}`);
      const yazi = el("span", "", `"${k.ham}" → ${k.ozet}${k.askida ? " (askıda: yanlış çıktı)" : ""}`);
      const sil = el("button", "", "sil"); sil.title = "Bu sözü unut: bir dahaki sefere yeniden LLM'e sorulur";
      sil.onclick = () => { ayar.ogrenilen!.sil(k.soz); ogrCiz(); };
      s.append(yazi, sil); ogrKutu.append(s);
    }
  };
  if (ayar.ogrenilen) {
    ogrKutu = document.createElement("details"); ogrKutu.className = "ogr";
    ogrKutu.append(el("summary", "", "öğrendiklerim"));
    ogrKutu.addEventListener("toggle", ogrCiz);
    kok.append(ogrKutu);
  }
  ogrenilenCiz = ogrCiz;
  kok.append(not);
  document.body.append(kok);

  let kaynak: ReturnType<typeof levelKaynagi> | null = null;
  let panel: HTMLElement | null = null;
  let acik = false;

  const goster = (a: boolean) => { acik = a; kok.classList.toggle("acik", a); };
  const kapat = () => { if (acik) goster(false); };
  const ac = () => {
    if (!kaynak) return;   // ova yokken pencere yok
    goster(true);
    ogrenilenCiz();   // kapalıyken öğrenilenler değişmiş olabilir
    ayar.acildi?.();
  };

  const ova = (level: Level | null) => {
    kapat();
    panel?.remove(); panel = null;
    kaynak?.dinleyicileriBosalt(); kaynak = null;
    if (!level) return;
    kaynak = levelKaynagi(level, ayar.ortam);
    panel = gorunumKur(kaynak, SHADERLAR);
    govde.append(panel);
  };

  kapatDugme.onclick = kapat;
  // Pencere açıkken tuşlar odaya sızmaz (G ve Esc hariç: onlar kapatır).
  kok.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Escape" || e.code === "KeyG") { e.preventDefault(); kapat(); }
  });
  kok.addEventListener("keyup", (e) => e.stopPropagation());

  // Sürükleme: başlıktan tut.
  bas.addEventListener("pointerdown", (e) => {
    if ((e.target as HTMLElement).tagName === "BUTTON") return;
    const r = kok.getBoundingClientRect();
    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    const tasi = (m: PointerEvent) => {
      kok.style.left = `${Math.max(0, Math.min(innerWidth - 80, m.clientX - dx))}px`;
      kok.style.top = `${Math.max(0, Math.min(innerHeight - 40, m.clientY - dy))}px`;
      kok.style.right = "auto";
    };
    const birak = () => { removeEventListener("pointermove", tasi); removeEventListener("pointerup", birak); };
    addEventListener("pointermove", tasi); addEventListener("pointerup", birak);
  });

  // TEK dinleyici: aç/kapat aynı olayda iki kez işlenirse pencere açılır açılmaz kapanır (canlıda böyle bozulmuştu).
  addEventListener("keydown", (e) => {
    if (e.code !== "KeyG" || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
    const h = e.target as HTMLElement | null;
    if (h && (h.tagName === "INPUT" || h.tagName === "TEXTAREA" || h.tagName === "SELECT")) return;
    if (acik) {
      // Odak pencerenin içindeyse pencerenin kendi dinleyicisi kapatır (olayı durdurur, buraya gelmez); dışındaysa burada.
      if (!(e.target instanceof Node && kok.contains(e.target))) { e.preventDefault(); kapat(); }
      return;
    }
    if (ayar.tusSerbest && !ayar.tusSerbest()) return;
    if (!kaynak) return;
    e.preventDefault();
    ac();
  });

  return { ova, ac, kapat, acikMi: () => acik };
}
