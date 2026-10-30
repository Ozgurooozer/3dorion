// uygulama/levelKapsamliDepo.ts — YERLEŞTİRME VE ZEMİN KAYITLARI LEVEL'A AİT (spec 42 2. aşama; Orion yeni level'a geçer).
//
// `orion.yerlestirme.v1` ve `orion.zemin.v1` tek global anahtardı: ova'da yerleştirilen nesneler ve boyanan arazi, başka bir level açılınca ONUN üstüne basılırdı (nesne kimlikleri
// çakışır, zemin vuruşları yabancı araziye yazılır). Sarmalayıcı anahtarı `<anahtar>@<proje>/<level>`e çevirir; kayıt kodu (`yerlestirmeKaydi.ts`, `zeminKaydi.ts`) DEĞİŞMEZ, yalnız
// ona verilen depo değişir. GÖÇ: eski (ekisiz) anahtar ova'ya aittir (bugüne dek tek level vardı): `ova` level'ında yeni anahtar yoksa eski okunur, yazılırken yeniye geçilir;
// eski anahtar SİLİNMEZ (geri dönüş yolu). Kapsam yoksa (`null`: açık proje yok, Electron'suz geliştirme) eski davranış birebir.
"use strict";
import { varsayilanDepo, type Depo } from "./yerlestirmeKaydi.ts";

/** Eski ekisiz kaydın ait olduğu level klasör adı (projenin şablon level'ı). */
export const GOC_LEVELI = "ova";

/** Kapsam dizgisi: proje ve level klasör adı. Göç kararı level adına bakar, bu yüzden ikisi ayrı verilir. */
export interface LevelKapsami { proje: string; level: string }

export const kapsamAnahtari = (anahtar: string, k: LevelKapsami): string => `${anahtar}@${k.proje}/${k.level}`;

/**
 * @param kapsam çağrı anında okunur (açılış level'ı asenkron çözülür); null → sarmalama yok.
 * @param depo   asıl depo; null → depo yok (sarmalayıcı da null döner, çağıranların "depolama yok" uyarısı korunur).
 */
export function levelKapsamliDepo(kapsam: () => LevelKapsami | null, depo: Depo | null = varsayilanDepo()): Depo | null {
  if (!depo) return null;
  return {
    getItem(k) {
      const s = kapsam();
      if (!s) return depo.getItem(k);
      const yeni = depo.getItem(kapsamAnahtari(k, s));
      if (yeni !== null) return yeni;
      return s.level === GOC_LEVELI ? depo.getItem(k) : null;
    },
    setItem(k, v) {
      const s = kapsam();
      depo.setItem(s ? kapsamAnahtari(k, s) : k, v);
    },
  };
}
