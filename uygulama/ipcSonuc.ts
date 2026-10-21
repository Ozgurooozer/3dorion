// uygulama/ipcSonuc.ts — Sonuç nesneli IPC'nin (host/kopru.ts `IpcSonuc`: md, ses) renderer tarafı açıcısı. TEK yer: mdDeposu ve ses bölümü bunu kullanır.
//
// Neden sonuç nesnesi: Electron `invoke` hata nesnesinin `kod` alanını taşımaz; arayüz "var / yok / kilitli / suruyor" ayrımını koda göre söylüyor.
"use strict";
import type { IpcSonuc } from "../host/kopru.ts";

/** Host işlemi hatası: `kod` host'un kodudur (md: yok | var | gecersiz-ad …; ses: kilitli | suruyor | silinemez | ag | boyut …). */
export class IpcHatasi extends Error {
  readonly kod: string;
  constructor(kod: string, mesaj: string) { super(mesaj); this.name = "IpcHatasi"; this.kod = kod; }
}

/** `{ ok, deger }` → değer; `{ ok: false, kod, mesaj }` → `hata(kod, mesaj)` fırlatılır (varsayılan `IpcHatasi`). */
export function ipcAc<T>(s: IpcSonuc<T>, hata: (kod: string, mesaj: string) => Error = (kod, mesaj) => new IpcHatasi(kod, mesaj)): T {
  if (!s.ok) throw hata(s.kod, s.mesaj);
  return s.deger;
}
