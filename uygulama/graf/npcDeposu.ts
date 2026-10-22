// uygulama/graf/npcDeposu.ts — NPC KAYITLARI DEPOSU (spec 35 dilim 3, NPC sınıfı): `<userData>/orion-npc/<ad>.json` (host/npcDosyalari.js).
//
// Grafik deposunun KOPYASI DEĞİL: kurallar ortak çekirdekte (`uygulama/dogruDosyaDeposu.ts`: yazmadan önce doğrula, ad = dosya adı, kanonik metin, bozuk
// dosya listede nedeniyle; `uygulama/dosyaDeposu.ts`: IPC / localStorage / çalışmayan kaynak, iş sırası). Burada NPC'ye özgü olan:
//   • biçim `protocol/npc.ts` `npcDogrula` (temiz kopya, tavanlar); ajanın defterde ve grafiklerin var olması DİNLEMEYE ALIRKEN denetlenir, kayıtta değil;
//   • listede ajan ve grafik adları (kart);
//   • SİL = KALDIR (host'ta `.silinenler/`e taşınır).
// DİNLEME BURADA DEĞİL: depo yalnız veriyi tutar; dinlemeye almak Ozyn'in NPC şeridindeki gerçek tıklaması (grafDinleyici'nin `dinlemeyeAl`ı, NPC kaydıyla).
"use strict";
import { npcAdiGecerli, npcDogrula, type Npc } from "../../protocol/npc.ts";
import type { Sonuc } from "../../protocol/dogrula.ts";
import { kabukKoprusu } from "../kabuk.ts";
import { DosyaHatasi, kaynakSec, yerelDosyaKaynagi, type Depo, type DosyaKaynagi } from "../dosyaDeposu.ts";
import { dogruDepoKur, type DogruDepo, type DogruKayit } from "../dogruDosyaDeposu.ts";

export const YEREL_NPC_ANAHTARI = "orion.npc.v1";

const npcHatasi = (kod: string, mesaj: string): Error => new DosyaHatasi(kod, mesaj);

/** NPC kaydının kanonik metni: iki boşluk girintili JSON (kısa kayıt; parametreler satır satır okunur). */
export const npcMetni = (n: Npc): string => `${JSON.stringify(n, null, 2)}\n`;

/** Metni NPC kaydına çevirir: JSON hatası ve biçim hatası NEDENLE (düzenleyici "KAYDEDİLEMEDİ: …" der). */
export function npcMetniCoz(metin: string): Sonuc<Npc> {
  let ham: unknown;
  try { ham = JSON.parse(metin); }
  catch (err) { return { ok: false, hata: `JSON okunamadı: ${err instanceof Error ? err.message : String(err)}` }; }
  const r = npcDogrula(ham);
  return r.ok ? r : { ok: false, hata: `biçim: ${r.hata}` };
}

/** Listedeki NPC: okunabildiyse ajanı ve grafikleri; bozuksa ajan null, grafikler boş ve `hata` nedeni. */
export type NpcKaydi = DogruKayit<{ ajan: string | null; graflar: readonly string[] }>;
export type NpcDeposu = DogruDepo<Npc, { ajan: string | null; graflar: readonly string[] }>;

export function npcDeposuKur(kaynak: DosyaKaynagi): NpcDeposu {
  return dogruDepoKur<Npc, { ajan: string | null; graflar: readonly string[] }>({
    kaynak, coz: npcMetniCoz, adi: (n) => n.ad, metin: npcMetni, ek: (n) => ({ ajan: n?.ajan ?? null, graflar: n ? [...n.graflar] : [] }),
    adGecerli: npcAdiGecerli, etiket: "NPC", adinSozu: "NPC'nin adı", gunluk: "[npc]",
  });
}

/** "＋ Yeni NPC"nin ilk kaydı: seçilen ajan + grafik, parametreler boş (Ozyn JSON penceresinde doldurur; nöbetçi için `parola`). */
export function yeniNpcKaydi(ad: string, ajan: string, graf: string, parametreler: Npc["parametreler"] = {}): Npc {
  return { surum: 1, ad, ajan, graflar: [graf], parametreler: { ...parametreler } };
}

/** localStorage kaynağı (Electron'suz geliştirme): ortak yerel kaynak, ek alan yok. Ad kuralı protokolün. */
export function yerelNpcKaynagi(depo: Depo, simdi: () => number = Date.now): DosyaKaynagi {
  return yerelDosyaKaynagi<Record<never, never>>(depo, {
    anahtar: YEREL_NPC_ANAHTARI, adGecerli: npcAdiGecerli, hata: npcHatasi, etiket: "NPC", adEtiketi: "NPC adı",
    yeniEk: () => ({}), ekAl: () => ({}),
  }, simdi);
}

/** Çalışma ortamına göre kaynak: Electron'da host dosyaları (IPC), değilse localStorage; ikisi de yoksa nedenli çalışmayan kaynak. */
export function npcKaynaginiSec(): { kaynak: DosyaKaynagi; hata: string | null } {
  const k = kabukKoprusu();
  return kaynakSec(k ? { liste: k.npcListe, oku: k.npcOku, yaz: k.npcYaz, yeni: k.npcYeni, sil: k.npcSil } : undefined, (d) => yerelNpcKaynagi(d), npcHatasi,
    { ne: "NPC kayıtları", onek: "[NPC]" });
}
