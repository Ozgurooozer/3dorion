// world/arayuz/menu/menuKonum.ts — Bağlam menüsünün KONUMLARI (spec 29): kök liste imlecin yanına, alt liste ata listenin YANINA. SAF.
//
// Alt liste varsayılan SAĞA açılır; sağda yer yoksa SOLA döner; ikisi de sığmıyorsa ekrana çekilir. Dikeyde alt listenin ilk satırı, ata listede üzerine
// gelinen satırla hizalanır, alta taşarsa yukarı çekilir. Kök liste de ekrana sığdırılır (imleç köşeye yakınsa içeri girer).
"use strict";

export interface Dikdortgen { sol: number; ust: number; en: number; boy: number }
export type AcilisYonu = "sag" | "sol";

const PAY = 8;
/** Alt liste ata listeyle bu kadar (px) bindirir: imleç satırdan alt listeye geçerken boşlukta kalmasın. */
const BINDIRME = 3;

const sinirla = (v: number, alt: number, ust: number): number => Math.max(alt, Math.min(v, ust));

/** Kök listenin sol-üst köşesi: imleç konumuna konur, ekrana sığmıyorsa içeri çekilir. */
export function kokKonumu(x: number, y: number, en: number, boy: number, ekranEn: number, ekranBoy: number, pay = PAY): { sol: number; ust: number } {
  return { sol: sinirla(x, pay, ekranEn - en - pay), ust: sinirla(y, pay, ekranBoy - boy - pay) };
}

/** Alt listenin konumu. `satirUst`: ata listede üzerine gelinen satırın üst kenarı (ekran koordinatı). */
export function altKonumu(ata: Dikdortgen, satirUst: number, en: number, boy: number, ekranEn: number, ekranBoy: number, pay = PAY): { sol: number; ust: number; yon: AcilisYonu } {
  const sagSol = ata.sol + ata.en - BINDIRME;
  const solSol = ata.sol - en + BINDIRME;
  let yon: AcilisYonu = "sag";
  let sol = sagSol;
  if (sagSol + en > ekranEn - pay) {
    if (solSol >= pay) { yon = "sol"; sol = solSol; }
    else {   // ikisi de sığmıyor: ekrana yaslanır, ata listeyle örtüşebilir ama erişilebilir kalır
      sol = sinirla(sagSol, pay, ekranEn - en - pay);
      yon = sol >= sagSol ? "sag" : "sol";
    }
  }
  return { sol, ust: sinirla(satirUst, pay, ekranBoy - boy - pay), yon };
}
