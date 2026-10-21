// uygulama/ayar/reflekslerBolumu.ts — AYAR PANELİ · REFLEKSLER bölümü: LLM'i atlayan yollar, boşta davranış, dikkat, kilitli içgüdüler (spec 34). DOM katmanı.
//
// NE AÇILIP KAPANIR, NE AÇILMAZ (karar ve gerekçe spec 34 §4):
//   • Doğuştan komutlar (`kopru.komut`): GERÇEK anahtar — pano teli `refleks.dogustan_komut`, köprü her kesin sözde okur. Kapatmak güvenli taraftır
//     (söz LLM'e gider). Kalıcı değil: açılış ölçülmüş varsayılana döner.
//   • Beceri refleksi (spec 10) ve süzgeç merceği (spec 12 Faz 5): SALT OKUNUR. Açılmaları ön-kayıtlı ölçüye/Ozyn'in kararına bağlı; buradan bir tıkla
//     açılabilseler o kapı anlamsızlaşırdı. Açma yolu yeniden başlatmadır (ORION_BECERI=1 / ?benliksuzgec=1) — panel bunu söyler.
//   • Ajanda (boşta bakış/jest) ve dikkat: devre panosunun mevcut düğmeleri (`pano.yaz`; tehlikeli olan `dikkat.azami` iki aşamalı teyitle).
//   • `ezilebilir: false` içgüdüler: anahtar değil kural (maliyet tavanı, sözleşme, insan denetimi) — yalnız liste ve neden.
"use strict";
import type { AyarBolumu } from "../../world/arayuz/ayarPaneli.ts";
import type { Pano } from "../../protocol/pano.ts";
import { kilitliIcguduler } from "./ayarModelleri.ts";
import { panoListesiKur } from "./panoListesi.ts";
import { el } from "./dom.ts";

export interface ReflekslerBolumuAyari {
  pano: () => Pano | null;
  /** Açılış yetki anahtarları (`uygulama/kopruKur.ts` `yetkiAnahtarlari`: köprüyle AYNI kaynak). */
  yetki: { beceri: boolean; benlikSuzgec: boolean };
  /** Doğuştan komut teli (özet için). */
  komut: () => boolean;
}

export function reflekslerBolumu(a: ReflekslerBolumuAyari): AyarBolumu {
  return {
    id: "refleksler", ad: "Refleksler", simge: "⚡", sira: 40, ajanlar: ["orion"],
    ipucu: "LLM'i atlayan yollar, boşta davranış ve dikkat; güvenlik içgüdüleri yalnız gösterilir",
    ozet: () => `komut ${a.komut() ? "açık" : "kapalı"} · beceri ${a.yetki.beceri ? "açık" : "kapalı"}`,
    kur(govde, arac) {
      govde.append(el("div", "ap-alt-baslik", "LLM'i atlayan yollar"));
      const komut = panoListesiKur(govde, a.pano, ["refleks.dogustan_komut"], arac.bildir);
      for (const y of [
        { ad: "beceri refleksi", acik: a.yetki.beceri, neden: "spec 10: açılması ön-kayıtlı ölçüye bağlı. Açmak: ORION_BECERI=1 ile yeniden başlat." },
        { ad: "süzgeç merceği", acik: a.yetki.benlikSuzgec, neden: "spec 12 Faz 5: açılması gölge ölçüsüne bağlı (Ozyn'in kararı). Açmak: ?benliksuzgec=1 ile yeniden başlat." },
      ]) {
        const satir = el("div", "ap-satir");
        const rozet = el("button", "ap-rozet", y.acik ? "● açık" : "○ kapalı"); rozet.type = "button"; rozet.disabled = true; rozet.dataset.acik = y.acik ? "1" : "0";
        rozet.title = y.neden;
        satir.append(el("span", "ap-etiket", y.ad), rozet);
        govde.append(satir, el("div", "ap-not", `🔒 ${y.neden}`));
      }
      govde.append(el("div", "ap-alt-baslik", "Boşta davranış (ajanda)"));
      const ajanda = panoListesiKur(govde, a.pano, ["ajanda.asgari", "ajanda.sapma"], arac.bildir);
      govde.append(el("div", "ap-alt-baslik", "Dikkat"));
      const dikkat = panoListesiKur(govde, a.pano, ["dikkat.tekrar", "dikkat.terminal_kis", "dikkat.azami"], arac.bildir);

      const kilitli = kilitliIcguduler();
      const ayrinti = el("details");
      const baslik = el("summary", "ap-alt-baslik", `Kilitli güvenlik içgüdüleri (${kilitli.length})`);
      baslik.style.cursor = "pointer";
      ayrinti.append(baslik, el("div", "ap-not", "Anahtar değil kural: maliyet tavanı, sözleşme ve insan denetimi. Öğrenilmiş bir kural bile bunları ezemez (mind/icgudu.ts); panelden kapatılamaz."));
      for (const i of kilitli) {
        const s = el("div", "ap-not", `🔒 ${i.kimlik} · ${i.katman} — ${i.aciklama}`);
        ayrinti.append(s);
      }
      govde.append(ayrinti);
      const tazele = () => { komut.tazele(); ajanda.tazele(); dikkat.tazele(); };
      return { goster: tazele, tazele };
    },
  };
}
