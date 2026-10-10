// world/level/editor/arayuz/anlamBilgisi.ts — Arayüz parçalarının ortak "bu nesne Orion için ne?" sorusu (spec 23 B).
// Katalog (kategori) ve anlam sözlüğü bir kez yüklenir; yüklenene dek etkin anlam sözlüksüz hesaplanır (varsayılan),
// yüklenince dinleyiciler yeniden çizer. Hesap saf: cekirdek/anlam.ts `etkinAnlam`.
"use strict";
import type { Editor } from "../editor.ts";
import type { NesneYeri } from "../../cekirdek/levelTanimi.ts";
import { etkinAnlam, type AnlamSozlugu, type EtkinAnlam } from "../../cekirdek/anlam.ts";
import { kisaAd } from "../../cekirdek/katalog.ts";

export interface AnlamBilgisi {
  etkin(n: Pick<NesneYeri, "varlik" | "ad" | "anlam">): EtkinAnlam;
  kategori(varlik: string): string | undefined;
  /** Yüklenince (ya da yüklüyse hemen) çağrılır. */
  hazirOlunca(f: () => void): void;
}

const onbellek = new WeakMap<Editor, AnlamBilgisi>();

export function anlamBilgisi(ed: Editor): AnlamBilgisi {
  const var_ = onbellek.get(ed);
  if (var_) return var_;
  let sozluk: AnlamSozlugu | null = null;
  const kategoriler = new Map<string, string>();
  let yuklendi = false;
  const bekleyenler: (() => void)[] = [];
  Promise.all([ed.katalog(), ed.anlamlar()]).then(([k, s]) => {
    for (const v of k.varliklar) kategoriler.set(v.ad, v.kategori);
    sozluk = s;
  }).catch((err: unknown) => { ed.durum.bildir(`anlam sözlüğü yüklenemedi: ${err instanceof Error ? err.message : String(err)}`, true); })
    .finally(() => { yuklendi = true; for (const f of bekleyenler.splice(0)) f(); });
  const b: AnlamBilgisi = {
    etkin: (n) => etkinAnlam(n, kategoriler.get(n.varlik), sozluk, kisaAd),
    kategori: (v) => kategoriler.get(v),
    hazirOlunca(f) { if (yuklendi) f(); else bekleyenler.push(f); },
  };
  onbellek.set(ed, b);
  return b;
}
