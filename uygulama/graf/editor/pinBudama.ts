// uygulama/graf/editor/pinBudama.ts — PİN DEĞİŞİNCE BAĞ BUDAMA (spec 35 dilim 2b). SAF.
//
// Bir düğümün pinleri AYARINA göre değişir ("Git" hedefi 'konum' → konum pini çıkar, 'ozyn' → kalkar; "Sıra 3" → üç çıkış; desenin giriş/çıkışları).
// Ayar değişince artık var olmayan pine ya da türü artık uymayan pine giden bağ BUDANIR — ve budananlar NEDENİYLE döner: editör kullanıcıya
// "x bağı kaldırıldı (pin kalktı)" der, geri al (Ctrl+Z) bağı geri getirir. Sessiz kayıp yok; sessiz bozuk bağ da yok.
// Ucu ÇÖZÜLEMEYEN düğümün bağına dokunulmaz (düğüm geçici olarak bozuk olabilir: desen adı yazılırken): onu denetim gösterir, budama silmez.
"use strict";
import type { Graf, GrafBagi, GrafDegeri } from "../../../protocol/graf.ts";
import type { Sonuc } from "../../../protocol/dogrula.ts";
import type { DugumKaydi, PinOrtami } from "../dugumKaydi.ts";
import { FONKSIYON_DONUS_TIPI, FONKSIYON_GIRIS_TIPI, dugumleriCozYapili, uyumlu } from "../grafTurDenetimi.ts";
import { ayarDegistir, grafBilgisiDegistir, type GrafBilgisi } from "./grafIslemleri.ts";
import { PIN_TIP_ADI } from "./bagKurali.ts";

export interface BudananBag { bag: GrafBagi; neden: string }

const yazi = (b: GrafBagi) => `${b.kaynak.join(".")} → ${b.hedef.join(".")}`;

/**
 * `dugumler`e dokunan bağlardan pini kalkanları ya da türü uymayanları çıkarır (verilmezse bütün bağlar). Grafik değişmezse aynı nesne döner.
 */
export function baglariBuda(g: Graf, kayit: DugumKaydi<unknown>, ortam: PinOrtami, dugumler?: ReadonlySet<string>): { graf: Graf; budanan: BudananBag[] } {
  const { cozum } = dugumleriCozYapili(g, kayit, ortam);
  const budanan: BudananBag[] = [];
  const kalan = g.baglar.filter((b) => {
    if (dugumler && !dugumler.has(b.kaynak[0]) && !dugumler.has(b.hedef[0])) return true;
    const k = cozum.get(b.kaynak[0]), h = cozum.get(b.hedef[0]);
    if (!k || !h) return true;
    const kp = k.pinler.cikislar.find((p) => p.ad === b.kaynak[1]);
    const hp = h.pinler.girisler.find((p) => p.ad === b.hedef[1]);
    if (!kp) { budanan.push({ bag: b, neden: `${yazi(b)}: '${b.kaynak[0]}' düğümünde '${b.kaynak[1]}' çıkışı artık yok` }); return false; }
    if (!hp) { budanan.push({ bag: b, neden: `${yazi(b)}: '${b.hedef[0]}' düğümünde '${b.hedef[1]}' girişi artık yok` }); return false; }
    if (!uyumlu(kp.tip, hp.tip)) { budanan.push({ bag: b, neden: `${yazi(b)}: türler artık uyuşmuyor (${PIN_TIP_ADI[kp.tip]} → ${PIN_TIP_ADI[hp.tip]})` }); return false; }
    return true;
  });
  return budanan.length ? { graf: { ...g, baglar: kalan }, budanan } : { graf: g, budanan };
}

/** Ayar yaz + o düğümün bağlarını buda (editörün her ayar değişikliği bu yoldan). */
export function ayarDegistirVeBuda(g: Graf, id: string, ad: string, deger: GrafDegeri | undefined, kayit: DugumKaydi<unknown>, ortam: PinOrtami): Sonuc<{ graf: Graf; budanan: BudananBag[] }> {
  const r = ayarDegistir(g, id, ad, deger);
  if (!r.ok) return r;
  return { ok: true, deger: baglariBuda(r.deger.graf, kayit, { ...ortam, buGraf: r.deger.graf }, new Set([id])) };
}

/**
 * Grafik bilgisini değiştir (desenin giriş/çıkışları) + Fonksiyon girişi/dönüşü düğümlerinin bağlarını buda: pinleri grafiğin `girisler`/`cikislar`ından gelir.
 * Bu deseni ÇAĞIRAN başka grafiklerin bağları burada budanmaz (başka dosyalar): onları o grafiğin denetimi gösterir (spec 35 §4e açıklar).
 */
export function grafBilgisiVeBuda(g: Graf, b: GrafBilgisi, kayit: DugumKaydi<unknown>, ortam: PinOrtami): Sonuc<{ graf: Graf; budanan: BudananBag[] }> {
  const r = grafBilgisiDegistir(g, b);
  if (!r.ok) return r;
  const yeni = r.deger.graf;
  const fonksiyonDugumleri = new Set(yeni.dugumler.filter((d) => d.tip === FONKSIYON_GIRIS_TIPI || d.tip === FONKSIYON_DONUS_TIPI).map((d) => d.id));
  return { ok: true, deger: baglariBuda(yeni, kayit, { ...ortam, buGraf: yeni }, fonksiyonDugumleri) };
}
