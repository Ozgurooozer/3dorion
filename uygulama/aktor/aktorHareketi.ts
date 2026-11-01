// uygulama/aktor/aktorHareketi.ts — HAREKET BİLEŞENİ ÇALIŞMA ZAMANI (spec 45 B4): komut (hız, dönüş) → her karede `hareketAdimi` (saf kural `hareketModeli.ts`) → gerçek düğüm.
// Komut level tanımına YAZMAZ; bellekte durur. (0, 0) komutu ve durma = kayıt silinir.
"use strict";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { bilesenAyari } from "../../world/level/cekirdek/bilesenKaydi.ts";
import { aktorHatasi, kodluHata } from "../../world/level/cekirdek/aktorHatalari.ts";
import { hareketAdimi, hareketKomutuHatasi, type HareketAyari, type HareketDurumu, type HareketKomutu } from "./hareketModeli.ts";
import { bilesenBul, type Aktor, type CalismaBaglami } from "./calismaBaglami.ts";

interface HareketKaydi { komut: HareketKomutu; durum: HareketDurumu; hareketli: boolean; yOfset: number; zemineYapis: boolean; bagli: boolean }

export interface AktorHareketi {
  /** Aktöre hız (m/s) ve dönme hızı (°/s) komutu; (0, 0) durdurur. Fırlatır (nedenle). */
  komutVer(a: Aktor, hiz: number, donus: number): void;
  ilerlet(dt: number): void;
  /** Aktörü artık olmayan kayıtları atar. */
  buda(varMi: (id: string) => boolean): void;
  sifirla(): void;
  sayi(): number;
  dokum(): { aktor: string; hiz: number; komut: { hiz: number; donus: number } }[];
}

const hareketAyari = (a: Aktor): HareketAyari | null => {
  const k = bilesenBul(a, "hareket");
  if (!k) return null;
  const v = bilesenAyari(k);
  return { azamiHiz: v["azamiHiz"] as number, ivme: v["ivme"] as number, donmeHizi: v["donmeHizi"] as number };
};

/** `bagliMi`: aktör şu an bir üste bağlı mı (bağlıyken yere yapışma kapalı: konumu üst belirler). */
export function aktorHareketiKur(b: CalismaBaglami, bagliMi: (id: string) => boolean): AktorHareketi {
  const hareketler = new Map<string, HareketKaydi>();

  return {
    sayi: () => hareketler.size,
    sifirla: () => hareketler.clear(),
    dokum: () => [...hareketler].map(([id, h]) => ({ aktor: id, hiz: h.durum.hiz, komut: { ...h.komut } })),
    buda(varMi) { for (const id of [...hareketler.keys()]) if (!varMi(id)) hareketler.delete(id); },

    komutVer(a, hiz, donus) {
      const id = a.id;
      const ayar = hareketAyari(a);
      if (!ayar) throw aktorHatasi("AKT-HRK-001", `'${id}' aktörünün hareket bileşeni yok (Details ▸ Bileşenler'den ekle)`);
      const n = b.dugumu(a);
      if (!n || !(n instanceof TransformNode)) throw aktorHatasi("AKT-HRK-005", `'${id}' nesnesi henüz yüklenmedi (ışık hareket edemez)`);
      const komut: HareketKomutu = { hiz, donus };
      const h = hareketKomutuHatasi(komut, ayar);
      if (h) throw kodluHata(`${id}: ${h}`);
      const mevcut = hareketler.get(id);
      b.gunluk.yaz("bilgi", "hareket", `${id} komut: hız ${hiz} m/s, dönüş ${donus} °/s`, { aktor: id });
      if (mevcut) { mevcut.komut = komut; return; }
      const l = b.level();
      if (!l) throw aktorHatasi("AKT-YTN-001", "level açık değil");
      n.rotationQuaternion = null;
      hareketler.set(id, {
        komut, hareketli: false, bagli: bagliMi(id),
        durum: { x: n.position.x, z: n.position.z, yaw: n.rotation.y, hiz: 0 },
        zemineYapis: bilesenAyari(bilesenBul(a, "hareket")!)["zemineYapis"] === true,
        yOfset: n.position.y - l.yukseklik(n.position.x, n.position.z),
      });
    },

    ilerlet(dt) {
      const l = b.level();
      if (!l) return;
      for (const [id, h] of [...hareketler]) {
        const a = b.aktorler().get(id), ayar = a ? hareketAyari(a) : null, n = a ? b.dugumu(a) : null;
        if (!a || !ayar || !n || !(n instanceof TransformNode)) { hareketler.delete(id); continue; }
        const r = hareketAdimi(h.durum, h.komut, ayar, dt);
        h.durum = r.durum;
        n.position.x = r.durum.x; n.position.z = r.durum.z;
        n.rotationQuaternion = null;
        n.rotation.y = r.durum.yaw;
        if (h.zemineYapis && !h.bagli) n.position.y = l.yukseklik(r.durum.x, r.durum.z) + h.yOfset;
        if (r.hareketli !== h.hareketli) {
          h.hareketli = r.hareketli;
          b.gunluk.yaz("bilgi", "hareket", r.hareketli ? `${id} hareket etmeye başladı` : `${id} durdu (x=${r.durum.x.toFixed(2)} z=${r.durum.z.toFixed(2)})`, { aktor: id });
          b.olayYolla(id, r.hareketli ? "hareket.basladi" : "hareket.durdu", {});
        }
        if (!r.hareketli && h.komut.hiz === 0 && h.komut.donus === 0) hareketler.delete(id);
      }
    },
  };
}
