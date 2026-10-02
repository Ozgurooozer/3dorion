// world/bilgisayar.ts — "Bilgisayarı aç" programı (spec 13 Faz 2a, robot çekirdeği).
//
// NEDEN VAR (ortak test 2, 2026-10-02): Ozyn "önündeki bilgisayarı aç", "open the
// monitor" dedi; Orion üç kez DOĞRU aracı seçti (`odaklan monitor`) ama dünyada onu
// yürüten kod yoktu — avatar "odaklan avatarın işi değil" diye reddetti. Monitörü
// yalnız Ozyn açabiliyordu.
//
// ROBOT İLKESİ (Ozyn): bedenin yapabildiği iş önce PROGRAMDIR. Program iki adım:
//   1. Sandalyede değilse otur (çapasız `otur` sandalyeye yürür ve oturur).
//   2. Monitörün terminali kapalıysa aç. Ozyn'in kamerası KAÇIRILMAZ: ekrana geçen
//      Ozyn değil Orion; Ozyn'in görüşü ve klavyesi olduğu yerde kalır.
// Komut çalıştırmak bu programın işi DEĞİL: `komut` niyeti onay kapısından geçer
// (onay.insan, Ozyn'in kararı 2026-10-02: her komut onaylı).
//
// Bağımlılıklar fonksiyon olarak verilir: avatarı ve pty'yi bilmeden sınanır.
// Bağımlılık: protocol/. Babylon yok.
"use strict";
import type { NiyetSonucu } from "../protocol/niyet.ts";

export interface BilgisayarBaglami {
  /** Orion şu an oturuyor mu (yalnız sandalyede oturulabilir). */
  oturuyorMu(): boolean;
  /** `otur` niyetini gönderir; sonucu (bitti/hata/iptal) gelince çözülür. */
  otur(): Promise<NiyetSonucu>;
  monitorAcikMi(): boolean;
  /** Monitörün pty'sini açar; kamerayı ve klavye odağını DEĞİŞTİRMEZ. Hata fırlatabilir. */
  monitorAc(): Promise<void>;
}

export interface ProgramSonucu {
  durum: "bitti" | "hata";
  /** Beyne geri beslenen not: ne oldu, sırada ne yapılabilir. */
  not: string;
}

/** Bilgisayarı aç programı. Asla fırlatmaz: her başarısızlık bir `hata` notudur. */
export async function bilgisayariAc(b: BilgisayarBaglami): Promise<ProgramSonucu> {
  if (!b.oturuyorMu()) {
    let s: NiyetSonucu;
    try { s = await b.otur(); }
    catch (e) { return { durum: "hata", not: `masaya oturamadım: ${e instanceof Error ? e.message : String(e)}` }; }
    if (s.durum !== "bitti") return { durum: "hata", not: `masaya oturamadım: ${s.not ?? s.durum}` };
  }
  if (!b.monitorAcikMi()) {
    try { await b.monitorAc(); }
    catch (e) { return { durum: "hata", not: `terminal açılamadı: ${e instanceof Error ? e.message : String(e)}` }; }
  }
  return {
    durum: "bitti",
    not: "The terminal on your monitor is open (PowerShell). To run a command, suggest it with dunya_komut; Ozyn approves it.",
  };
}
