// uygulama/menuKatkilari.ts — SAĞ TIK MENÜSÜNÜN KATKILARI (spec 29): hangi hedefte hangi öğe, hangi YOLDA. Çekirdek (`world/arayuz/menu/menuModeli.ts`) hedef bilmez;
// hedefi bilen burasıdır. Eylem mantığı (uygun mu, neden gri, hangi niyet) DEĞİŞMEDİ: `nesneEylemleri` / `hedefEylemleri` aynen çağrılır, burada yalnız
// "menüde nereye girer" söylenir. Yeni hedef (terminal, tahta, duvar…) = yeni `hedef.tur` + buraya yeni katkı.
//
// Yollar bir yerde durur (aşağıdaki tablolar): menüdeki adı/yeri değiştirmek tek satırdır. Tek eylem yolu değişmez: yaprak yükü `NesneEylemi`dir,
// çalıştırma `uygulama/nesneEtkilesimi.ts` → `niyetiYurut`.
"use strict";
import type { MenuKatkisi, MenuOgesi } from "../world/arayuz/menu/menuModeli.ts";
import type { NesneEylemi } from "../world/yer/nesneEylemleri.ts";
import type { YurumeAlani } from "../world/yer/yer.ts";
import { zeminEylemleri, orionEylemleri, type OrionBaglami, type ZeminNoktasi } from "../world/yer/hedefEylemleri.ts";

/** Menü yaprağının yükü: bir hedef eylemi ya da menünün kendi iki komutu. */
export type MenuEylemi =
  | { tur: "eylem"; eylem: NesneEylemi }
  | { tur: "ozellikler" }
  | { tur: "secimiKaldir" };

export type MenuHedefi =
  | { tur: "zemin"; nokta: ZeminNoktasi; alan: YurumeAlani }
  | { tur: "orion"; orion: OrionBaglami }
  | { tur: "nesne"; ad: string; eylemler: readonly NesneEylemi[] };

export interface HedefMenuBaglami { hedef: MenuHedefi }
export type HedefKatkisi = MenuKatkisi<HedefMenuBaglami, MenuEylemi>;

const yuk = (eylem: NesneEylemi): MenuEylemi => ({ tur: "eylem", eylem });
const yapak = (e: NesneEylemi, yol: readonly string[], sira: number, grup: string): MenuOgesi<MenuEylemi> =>
  ({ yol, kimlik: e.kimlik, sira, grup, uygun: e.uygun, ...(e.neden ? { neden: e.neden } : {}), eylem: yuk(e) });

/** Zemin: "Buraya ▸ Git / Bak". Kimlik → yol tablosu (zeminEylemleri'nin kimlikleri). */
const ZEMIN_YOLU: Readonly<Record<string, readonly string[]>> = { "orion.git": ["Buraya", "Git"], "orion.bak": ["Buraya", "Bak"] };

const zeminKatkisi: HedefKatkisi = {
  kimlik: "zemin", hedefler: ["zemin"],
  ogeler: (b) => {
    const h = b.hedef;
    if (h.tur !== "zemin") return [];
    return zeminEylemleri(h.nokta, h.alan).flatMap((e, i) => { const y = ZEMIN_YOLU[e.kimlik]; return y ? [yapak(e, y, 10 + i, "orion")] : []; });
  },
};

/** Orion'a tıklayınca: bedensel komutlar doğrudan listede (alt menüsüz; kısa liste). */
const orionKatkisi: HedefKatkisi = {
  kimlik: "orion", hedefler: ["orion"],
  ogeler: (b) => {
    const h = b.hedef;
    if (h.tur !== "orion") return [];
    return orionEylemleri(h.orion).map((e, i) => yapak(e, [e.ad], 10 + i, "orion"));
  },
};

/** Nesne: "Orion ▸ …" (Orion yapsın) ve "Ben ▸ …" (ben yapayım). */
const nesneKatkisi: HedefKatkisi = {
  kimlik: "nesne", hedefler: ["nesne"],
  ogeler: (b) => {
    const h = b.hedef;
    if (h.tur !== "nesne") return [];
    return h.eylemler.map((e, i) => yapak(e, [e.kim === "orion" ? "Orion" : "Ben", e.ad], (e.kim === "orion" ? 10 : 50) + i, e.kim));
  },
};

/** Her hedefin sonunda: "Özellikler…" (bilgi paneli). */
const ozelliklerKatkisi: HedefKatkisi = {
  kimlik: "ozellikler", hedefler: "hepsi",
  ogeler: () => [{ yol: ["Özellikler…"], kimlik: "menu.ozellikler", sira: 900, grup: "son", uygun: true, eylem: { tur: "ozellikler" } }],
};

/** Yalnız nesne: seçimi kaldır. */
const secimiKaldirKatkisi: HedefKatkisi = {
  kimlik: "secimiKaldir", hedefler: ["nesne"],
  ogeler: () => [{ yol: ["Seçimi kaldır"], kimlik: "menu.secimiKaldir", sira: 910, grup: "son", uygun: true, eylem: { tur: "secimiKaldir" } }],
};

/** Menünün bütün katkıları (kayıt sırası önemsiz: sıra/grup öğelerin kendisinde). */
export const MENU_KATKILARI: readonly HedefKatkisi[] = [zeminKatkisi, orionKatkisi, nesneKatkisi, ozelliklerKatkisi, secimiKaldirKatkisi];
