// uygulama/yapi/graf/sekmeDosyalari.ts — EDİTÖR SEKMELERİ ile DOSYALAR (spec 35 dilim 2b): dışarıdan değişiklik/silinme, yeniden adlandır, kopyasını oluştur.
//
//   • Dosya editör dışında değişti (JSON penceresi, ileride Orion'un önerisi): sekme TEMİZSE diskteki hâle yenilenir; KİRLİYSE Ozyn'in yazdığı EZİLMEZ,
//     bant çıkar ("Diskteki hâli al / Benimkini koru"). Kendi kaydımızın yankısı (aynı kanonik metin) değişiklik sayılmaz.
//   • Dosya kalktı (Graf sekmesinden silindi): sekme durur ama kaydedilemez (bant söyler).
//   • YENİDEN ADLANDIR: grafDeposu.yenidenAdlandir (yeni dosya + eskisi .silinenler'e; KULLANILAN DESEN reddedilir — çağıranlar sessizce kırılmasın).
//     Editör ek olarak reddeder: sekme kirliyse (önce kaydet), grafik çalışıyorsa (önce ■), dinlemedeyse (önce bırak: dinleyici eski adı tutar).
//     Bellekteki değişken durumu (grafDurumu) grafik ADIYLA anahtarlıdır: yeni ada taşınmaz — mesajda söylenir.
"use strict";
import type { Graf } from "../../../protocol/graf.ts";
import { grafMetni, type GrafDeposu } from "../../graf/grafDeposu.ts";
import type { GrafCalistirici } from "../../graf/grafCalistirici.ts";
import type { GrafDinleyici } from "../../graf/grafDinleyici.ts";
import type { EditorOturumu } from "../../graf/editor/editorOturumu.ts";
import type { SekmeListesi } from "../../duzenleyici/sekmeler.ts";
import type { MesajTuru } from "./editorBaglami.ts";

export interface SekmeDosyalariAyari {
  sekmeler: SekmeListesi<EditorOturumu>;
  depo: GrafDeposu;
  calistirici: GrafCalistirici;
  dinleyici: GrafDinleyici;
  yeniden(o: EditorOturumu, g: Graf): void;
  bildir(m: string, tur?: MesajTuru): void;
  altyazi(m: string, ms?: number): void;
  /** Değişiklikten sonra (editör açıksa çizer). */
  degisti(): void;
  coktu(err: unknown): void;
}

export function sekmeDosyalariKur(a: SekmeDosyalariAyari): { yenidenAdlandir(eski: string, yeni: string): Promise<void>; kopyasiniOlustur(ad: string, yeni: string): Promise<void> } {
  a.depo.dinle((ev) => {
    try {
      for (const s of a.sekmeler.hepsi()) {
        s.icerik.cozumuUnut();   // başka dosya (desen) değişmiş olabilir: Desen düğümünün pinleri ondan
        if (!a.depo.liste().some((k) => k.ad === s.ad)) { s.icerik.dis = "silindi"; continue; }
        if (s.icerik.dis === "silindi") s.icerik.dis = null;
        const disk = a.depo.al(s.ad);
        if (ev.tur !== "icerik" || ev.ad !== s.ad || !disk) continue;
        if (grafMetni(disk) === grafMetni(s.icerik.graf())) continue;
        if (!s.icerik.gecmis.kirli()) a.yeniden(s.icerik, disk);
        else s.icerik.dis = "degisti";
      }
      a.degisti();
    } catch (err) { a.coktu(err); }
  });

  return {
    async yenidenAdlandir(eski, yeni) {
      if (eski === yeni) return;
      const s = a.sekmeler.al(eski);
      if (s?.icerik.gecmis.kirli()) throw new Error(`'${eski}' editörde kaydedilmemiş değişiklikle açık: önce kaydet (Ctrl+S) ya da sekmeyi kapat`);
      if (a.calistirici.durum().calisiyor?.graf === eski || a.dinleyici.calisiyorMu(eski)) throw new Error(`'${eski}' çalışıyor: önce ■ Durdur`);
      if (a.dinleyici.dinlemedeMi(eski)) throw new Error(`'${eski}' dinlemede: önce ⚡ Dinlemeyi bırak`);
      await a.depo.yenidenAdlandir(eski, yeni);
      if (s && a.sekmeler.adDegistir(eski, yeni)) {
        const g = a.depo.al(yeni);
        if (g) { a.yeniden(s.icerik, g); s.icerik.dis = null; }
      }
      a.bildir(`'${eski}' → '${yeni}' (eski dosya .silinenler'de; bellekteki değişken durumu eski adda kaldı)`, "iyi");
      a.altyazi(`'${eski}' artık '${yeni}'`, 2500);
      a.degisti();
    },
    async kopyasiniOlustur(ad, yeni) {
      await a.depo.kopyasiniOlustur(ad, yeni);
      a.bildir(`'${ad}' kopyalandı: '${yeni}'${a.sekmeler.al(ad)?.icerik.gecmis.kirli() ? " (kaydedilmiş hâli; editördeki kaydedilmemiş değişiklik kopyaya girmedi)" : ""}`, "iyi");
      a.altyazi(`kopya oluşturuldu: ${yeni}`, 2500);
    },
  };
}
