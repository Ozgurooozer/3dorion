// uygulama/sohbetHedefi.ts — SOHBET HEDEF ÇİPLERİ (spec 33 dilim 5): söz kime gidecek — Orion | Flash | İkisi. DOM katmanı.
//
// Mantık saf modelde (`uygulama/ajanlar/cipModeli.ts`: seçim, döngü, "hatırlanan henüz yoksa ilk"; testli); burası yalnız çizer ve tuşu
// bağlar. Sohbet kutusu açıkken fare çoğu zaman kilitli olduğundan asıl yol klavye: girdi kutusunda Tab / Shift+Tab hedefi değiştirir
// (dünya INPUT'taki tuşu zaten çalmaz, world/player/oyuncu.ts). Fare serbestse çipe tıklamak da seçer. Yer tutucu metin hedefi söyler.
// Seçim tarayıcı deposunda hatırlanır (`orion.sohbetHedefi`; yalnız kolaylık — depo yoksa her açılış Orion'la başlar).
// Tek ajan varken (Flash kurulmadı: senaryo, `?flashsiz`) şerit boş ve gizli: sohbet kutusu bugünkü gibi görünür.
"use strict";
import type { CipSecimi } from "./ajanlar/cipModeli.ts";

export const HEDEF_DEPO_ANAHTARI = "orion.sohbetHedefi";

export function hatirlananHedef(): string | null {
  try { return localStorage.getItem(HEDEF_DEPO_ANAHTARI); } catch { return null; }
}

export function sohbetHedefiKur(d: { kok: HTMLElement; girdi: HTMLInputElement; secim: CipSecimi }): void {
  const { kok, girdi, secim } = d;
  const ciz = (): void => {
    const l = secim.secenekler();
    const etkin = secim.etkin();
    kok.replaceChildren();
    if (l.length >= 2) {
      for (const c of l) {
        const b = document.createElement("button");
        b.type = "button"; b.className = "hedef-cip"; b.dataset.secili = c.id === etkin ? "1" : "0";
        b.style.setProperty("--cip", c.renk);
        b.title = `söz ${c.etiket} hedefine gider (Tab: sıradaki)`;
        const nokta = document.createElement("i"); nokta.style.background = c.renk;
        b.append(nokta, c.etiket);
        // mousedown: girdi kutusu odağı kaybetmesin (tıklayınca sohbet kapanmasın).
        b.addEventListener("mousedown", (e) => { e.preventDefault(); secim.sec(c.id); });
        kok.append(b);
      }
    }
    const ad = l.find((c) => c.id === etkin)?.etiket ?? "Orion";
    girdi.placeholder = l.length >= 2
      ? `→ ${ad} · yaz… (Tab: kime · Enter gönder · Esc kapat)`
      : "Orion'a yaz… (T ile aç, Enter gönder, Esc kapat)";
  };
  girdi.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || secim.secenekler().length < 2) return;
    e.preventDefault();   // tarayıcı odağı kaydırmasın
    secim.dongu(e.shiftKey ? -1 : 1);
  });
  secim.dinle((id) => {
    ciz();
    try { if (id) localStorage.setItem(HEDEF_DEPO_ANAHTARI, id); } catch { /* depo kapalı: yalnız bu oturum */ }
  });
  ciz();
}
