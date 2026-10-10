// world/level/depo/httpDeposu.ts — Level deposu, GELİŞTİRME sunucusu üzerinden (vite: tools/vite-level.ts).
// Okuma statik dosyadan (önbelleksiz), yazma /__level/* uç noktalarından. Sunucu hatası metniyle fırlatılır;
// 409 → VarHatasi (arayüz onay sorar).
"use strict";
import { VarHatasi, type LevelDeposu, type LevelOzeti } from "./levelDeposu.ts";

const getir = async (url: string, secenek?: RequestInit): Promise<Response> => {
  const r = await fetch(url, secenek);
  if (r.status === 409) throw new VarHatasi(await r.text());
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return r;
};
const yaz = async (url: string, govde: unknown) =>
  (await getir(url, { method: "POST", headers: { "content-type": "application/json" }, body: typeof govde === "string" ? govde : JSON.stringify(govde) })).text();
const kodla = encodeURIComponent;

/** `kok`: level klasörlerinin URL kökü (vite kökü = repo). */
export function httpDeposuKur(kok = "/world/level"): LevelDeposu {
  return {
    yazilabilir: true,
    liste: async () => (await (await getir("/__level/liste")).json()) as LevelOzeti[],
    sablonlar: async () => (await (await getir("/__level/sablonlar")).json()) as string[],
    oku: async (ad) => (await getir(`${kok}/${kodla(ad)}/${kodla(ad)}.level.json?t=${Date.now()}`)).json(),
    sablonOku: async (ad) => (await getir(`${kok}/sablon/${kodla(ad)}.level.json?t=${Date.now()}`)).json(),
    kaydet: (ad, t) => yaz(`/__level/kaydet?ad=${kodla(ad)}`, t),
    olustur: (ad, t) => yaz(`/__level/yeni?ad=${kodla(ad)}`, t),
    hazirListe: async () => (await (await getir("/__level/hazir")).json()) as string[],
    hazirOku: async (ad) => (await getir(`/__level/hazir?ad=${kodla(ad)}`)).json(),
    hazirKaydet: (ad, p, ez) => yaz(`/__level/hazir?ad=${kodla(ad)}${ez ? "&ez=1" : ""}`, p),
  };
}
