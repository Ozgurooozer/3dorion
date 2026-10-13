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
}

/** Canlı level'ı panelin soyut kaynağına bağlar: geçmiş yok, hata sessiz değil (konsola düşer, eski hâl kalır). */
export function levelKaynagi(level: Level): GorunumKaynagi & { dinleyicileriBosalt(): void } {
  let dinleyiciler: (() => void)[] = [];
  const yay = () => { for (const f of dinleyiciler) f(); };
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
    dinleyicileriBosalt: () => { dinleyiciler = []; },
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
  const not = el("div", "not", "Değişiklikler yalnız bu oturumdaki ova'ya uygulanır; dosyaya yazılmaz. Kalıcı stil için editör sayfası (ova-deneme.html).");
  kok.append(bas, govde, not);
  document.body.append(kok);

  let kaynak: ReturnType<typeof levelKaynagi> | null = null;
  let panel: HTMLElement | null = null;
  let acik = false;

  const goster = (a: boolean) => { acik = a; kok.classList.toggle("acik", a); };
  const kapat = () => { if (acik) goster(false); };
  const ac = () => {
    if (!kaynak) return;   // ova yokken pencere yok
    goster(true);
    ayar.acildi?.();
  };

  const ova = (level: Level | null) => {
    kapat();
    panel?.remove(); panel = null;
    kaynak?.dinleyicileriBosalt(); kaynak = null;
    if (!level) return;
    kaynak = levelKaynagi(level);
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

  addEventListener("keydown", (e) => {
    if (e.code !== "KeyG" || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
    const h = e.target as HTMLElement | null;
    if (h && (h.tagName === "INPUT" || h.tagName === "TEXTAREA" || h.tagName === "SELECT")) return;
    if (acik) return;   // açıkken kapatmayı pencerenin kendi dinleyicisi yapar (odaktaysa); odak dışındaysa aşağıda
    if (ayar.tusSerbest && !ayar.tusSerbest()) return;
    if (!kaynak) return;
    e.preventDefault();
    ac();
  });
  // Odak pencerede değilken (sahneye tıklanmış) G ile kapatma: açıkken ikinci basış kapatır.
  addEventListener("keydown", (e) => {
    if (acik && e.code === "KeyG" && !e.repeat && !(e.target instanceof Node && kok.contains(e.target))) { e.preventDefault(); kapat(); }
  });

  return { ova, ac, kapat, acikMi: () => acik };
}
