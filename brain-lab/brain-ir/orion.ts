// brain-ir/orion.ts — Brain IR deneyini mevcut Orion köprüsüne takılan adaptör.
// Mevcut bridge/world/mind dosyalarını değiştirmez; yalnızca Beyin sözleşmesini uygular.
"use strict";
import type { Beyin, BeyinCikti, BeyinGirdisi } from "../../bridge/beyin.ts";
import { BrainSimulator } from "./simulator.ts";
import { type BrainGrafi, type BrainInputlari, type OrionAksiyon, type OrionBrainSonucu } from "./ir.ts";
import type { OlayGunlugu } from "./olayGunlugu.ts";

export interface OrionBrainAyari {
  /** Orion bağlamını sensör sinyallerine çeviren deneysel katman. */
  duyarga: (girdi: BeyinGirdisi) => BrainInputlari;
  /** Action düğümü 1 olduğunda üretilecek mevcut Orion aracı. */
  aksiyonlar: { node: string; arac: string; girdi: Record<string, unknown> }[];
  /** Düşünme ve üretilen aksiyonların özel numaralı olay kaydı. */
  olayGunlugu?: OlayGunlugu;
  ad?: string;
  adim?: number;
}

export class BrainIrBeyni implements Beyin {
  readonly ad: string;
  private readonly simulator: BrainSimulator;
  private readonly ayar: OrionBrainAyari;
  private sonCalisma: OrionBrainSonucu | null = null;

  constructor(graf: BrainGrafi, ayar: OrionBrainAyari) {
    this.simulator = new BrainSimulator(graf);
    this.ayar = ayar;
    for (const action of ayar.aksiyonlar) {
      const node = graf.nodes.find((candidate) => candidate.id === action.node);
      if (!node || node.type !== "action") {
        throw new Error(`aksiyon düğümü action olmalı: ${action.node}`);
      }
      if (!action.arac.startsWith("dunya_")) {
        throw new Error(`Orion aracı dunya_ ile başlamalı: ${action.arac}`);
      }
    }
    this.ad = ayar.ad ?? `brain-ir:${graf.name ?? "untitled"}`;
  }

  async hazirMi(): Promise<boolean> { return true; }

  async dusun(girdi: BeyinGirdisi): Promise<BeyinCikti> {
    const sensors = this.ayar.duyarga(girdi);
    const calisma = this.simulator.run(sensors, this.ayar.adim);
    const aksiyonlar: OrionAksiyon[] = this.ayar.aksiyonlar
      .filter((action) => calisma.final.outputs[action.node] === 1)
      .map((action) => ({ ...action, girdi: { ...action.girdi } }));
    this.sonCalisma = { ...calisma, aksiyonlar };

    // Olay kaydı karar yolunun önüne geçmez. Günlük/hafıza bozuksa beyin
    // yine cevap verir; numaralı kayıt yalnızca gözlem ve geri çağırma içindir.
    let olayId: string | undefined;
    const aksiyonOlaylari: string[] = [];
    try {
      const olay = this.ayar.olayGunlugu?.kaydet({
        tur: "beyin_cagrisi",
        metin: `${this.ad} düşünme çağrısı`,
        veri: { grafik: this.ad, sensörler: sensors, tick: calisma.final.tick, aksiyonlar, iz: calisma.trace },
      });
      olayId = olay?.id;
      for (const action of aksiyonlar) {
        const aksiyonOlayi = this.ayar.olayGunlugu?.kaydet({
          tur: "beyin_aksiyonu",
          metin: `${action.arac} aksiyonu üretildi`,
          veri: {
            cagriOlayi: olayId,
            node: action.node,
            arac: action.arac,
            girdi: action.girdi,
            nedenselIz: calisma.final.trace.find((x) => x.node === action.node),
          },
        });
        if (aksiyonOlayi) aksiyonOlaylari.push(aksiyonOlayi.id);
      }
    } catch (err) {
      console.warn("[brain-ir] olay kaydı başarısız, akış sürüyor:", err);
    }

    return {
      metin: "",
      cagrilar: aksiyonlar.map((action) => ({ ad: action.arac, girdi: action.girdi })),
      bilgi: {
        motor: "brain-ir",
        grafik: this.ad,
        tick: calisma.final.tick,
        sensörler: sensors,
        iz: calisma.steps,
        olayId,
        aksiyonOlaylari,
      },
    };
  }

  iz(): OrionBrainSonucu | null {
    return this.sonCalisma;
  }
}
