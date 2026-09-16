// world/engine/fareKipi.ts — Farenin ne zaman kamerayı sürdüğü kararı.
//
// NEDEN AYRI DOSYA: bu mantık `KameraRig` içindeydi ve orayı şişiriyordu —
// kamera zaten modlar, odak, sinematik ve duvar çarpışmasıyla uğraşıyor.
// Grafik incelemesi de `KameraRig`i en yüksek betweenness düğümü olarak
// işaretledi: adının ima ettiğinden çok daha fazla alt sisteme dokunuyordu.
//
// Asıl kazanç şu: fare kipi KARARI kamera geometrisinden bağımsız. Burada
// Babylon yok, sahne yok, matris yok — yalnızca "hangi durumda fare neyi
// sürer" sorusu. Bu yüzden tek başına ve ucuza sınanabiliyor.
//
// ── KURAL: kip ODAĞA bağlı ────────────────────────────────────────────────
//
//   GEZİNİRKEN (odak yok)   → fare KAMERAYI sürer (kilitli imleç, klasik).
//                             Bakmak için tuşa basmak gerekmez.
//   ODAKTAYKEN (ekran/panel)→ imleç SERBEST: tıklayıp nesne seçebilirsin.
//                             Kamerayı ayarlamak istersen Ctrl basılı tut.
//
// Odakta pointer lock ALINMAZ: `movementX/Y` kilitsiz `mousemove`da da gelir.
// Kilit alsaydık imleç kaybolur ve `Ctrl+C` kabuğun elinden giderdi.
"use strict";

export interface FareKipiAyari {
  /** Olayların bağlanacağı tuval. */
  tuval: HTMLCanvasElement;
  /** Şu an bir yüzeye odaklanılmış mı (terminal/panel)? */
  odaktaMi: () => boolean;
  /** Pointer lock iste — yalnızca gezinirken çağrılır. */
  kilitIste: () => void;
  /** Kilit gerçekten bizde mi? */
  kilitliMi: () => boolean;
  /** Bakışı döndür (ham fare deltası; ölçekleme çağrılana ait). */
  dondur: (dx: number, dy: number) => void;
}

export interface FareKipi {
  /** Fare şu an kamerayı sürüyor mu? HUD için. */
  readonly kamerada: boolean;
  /** Ctrl basılı mı — tanı ve test için. */
  readonly ctrlBasili: boolean;
  /** Dinleyicileri çöz. */
  sok(): void;
}

export function fareKipiKur(a: FareKipiAyari): FareKipi {
  let ctrlBasili = false;

  const surebilirMi = (): boolean =>
    a.odaktaMi() ? ctrlBasili : a.kilitliMi();

  const fareHareket = (e: MouseEvent) => {
    if (!surebilirMi()) return;
    a.dondur(e.movementX ?? 0, e.movementY ?? 0);
  };

  // Gezinirken tuvale tıklamak kamerayı ele alır — klasik davranış.
  // Odaktayken tıklama kilide GİTMEZ: orada tıklamanın işi nesne seçmek.
  const tuvalTik = () => { if (!a.odaktaMi()) a.kilitIste(); };

  const ctrlBas = (e: KeyboardEvent) => {
    if (e.key !== "Control" || e.repeat) return;
    ctrlBasili = true;
  };
  const ctrlBirak = (e: KeyboardEvent) => {
    if (e.key !== "Control") return;
    ctrlBasili = false;
  };
  // Pencere odağı giderken (alt-tab) keyup gelmez; Ctrl basılı takılmasın.
  const odakGitti = () => { ctrlBasili = false; };

  addEventListener("mousemove", fareHareket);
  addEventListener("keydown", ctrlBas);
  addEventListener("keyup", ctrlBirak);
  addEventListener("blur", odakGitti);
  a.tuval.addEventListener("click", tuvalTik);

  return {
    get kamerada() { return surebilirMi(); },
    get ctrlBasili() { return ctrlBasili; },
    sok() {
      removeEventListener("mousemove", fareHareket);
      removeEventListener("keydown", ctrlBas);
      removeEventListener("keyup", ctrlBirak);
      removeEventListener("blur", odakGitti);
      a.tuval.removeEventListener("click", tuvalTik);
    },
  };
}
