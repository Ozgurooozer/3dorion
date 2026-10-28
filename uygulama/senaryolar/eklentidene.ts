// uygulama/senaryolar/eklentidene.ts — `3dorion.bat eklentidene` (spec 40): eklenti altyapısı ÇALIŞMA ANINDA — defter, Ayarlar ▸ Eklentiler bölümü, mevcut özelliklerin kapıları.
//
// Ölçülenler, hepsi SONUÇ olarak (defter durumu, gerçek DOM, dok panel durumu):
//   K1  açılışta mevcut özelliklerin HEPSİ açık ve çalışıyor (bugünkü motor); düşünme kipi varsa KAPALI.   K2  Ayarlar ▸ Eklentiler bölümü gerçek DOM'da: her eklenti bir satır, başlık özeti.
//   K3  rozete tıkla → ajanda kapanır (defter + rozet + özet), tekrar tıkla açılır.                       K4  panel eklentisi kapanınca panel gizli, Pencere menüsü satırı pasif, I tuşu açmaz; açınca geri gelir.
//   K5  yeniden_baslat eklentisi (Flash) kapanınca "kapanacak · yeniden başlat" der, çalışan hâl DEĞİŞMEZ (sahte anında yok).
// Kareler ORION_SS_DIR'e PNG. Bütün eklentiler sonda varsayılana döner (SMOKE'ta kalıcı kayıt zaten yazılmaz).
"use strict";
import type { SenaryoBaglami } from "../senaryoBaglami.ts";

export async function kos(d: SenaryoBaglami): Promise<void> {
  const bekle = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const log = (m: string) => console.log("[EKLENTIDENE] " + m);
  let gecen = 0, kalan = 0;
  const kontrol = (ad: string, ok: boolean, ek = "") => { if (ok) gecen++; else kalan++; log(`${ok ? "GECTI" : "KALDI"} ${ad}${ek ? ` — ${ek}` : ""}`); };
  const bitir = () => console.log(`[EKLENTIDENE] ${kalan === 0 ? "GECTI" : "KALDI"} — ${gecen}/${gecen + kalan}`);
  const ss = async (ad: string) => { console.log("[KLIPSS] " + ad); await bekle(400); };

  const e = d.eklentiler, dok = d.dok;
  const MEVCUT = ["hafiza-yonlendirici", "ajanda", "flash", "panel-icerik", "panel-outliner", "panel-onizleme"];
  const durum = (id: string) => e.durum().find((x) => x.bildirim.id === id)!;
  const satir = (id: string) => document.querySelector<HTMLElement>(`#ayarPaneli .ap-satir[data-eklenti="${id}"]`);
  const rozet = (id: string) => satir(id)?.querySelector<HTMLButtonElement>(".ap-rozet") ?? null;
  const tik = async (b: HTMLElement | null) => { b?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); await bekle(250); };

  // ── K1 ──
  const hepsiAcik = MEVCUT.every((id) => { const s = durum(id); return s.acik && s.calisiyor && s.hata === null; });
  const dusunme = e.durum().find((x) => x.bildirim.id === "dusunme-kipi");
  kontrol("K1 mevcut altı özellik AÇIK ve çalışıyor (bugünkü motor); varsa düşünme kipi KAPALI başlar", hepsiAcik && (!dusunme || (!dusunme.acik && dusunme.secenek === "kapali")),
    `açık=${e.durum().filter((x) => x.acik).map((x) => x.bildirim.id).join(",")} uyarı=${e.uyarilar.length}`);

  // ── K2 ──
  d.ayarAc();
  await bekle(500);
  const bas = document.querySelector<HTMLElement>('#ayarPaneli button[aria-controls="ap-orion-eklentiler"]');
  if (bas && bas.parentElement?.dataset.acik !== "1") await tik(bas);
  await bekle(300);
  const gorunenSatir = MEVCUT.filter((id) => !!satir(id));
  const ozet = bas?.querySelector(".ap-ozet")?.textContent ?? "";
  kontrol("K2 Ayarlar ▸ Eklentiler: her eklenti bir satır; başlık özeti 'N/M açık'", !!bas && gorunenSatir.length === MEVCUT.length && /^\d+\/\d+ açık/.test(ozet), `satır=${gorunenSatir.length}/${MEVCUT.length} özet="${ozet}"`);
  await ss("01_eklentiler");

  // ── K3 ──
  await tik(rozet("ajanda"));
  const ajandaKapali = !durum("ajanda").acik && !e.acikMi("ajanda") && /kapalı/.test(rozet("ajanda")?.textContent ?? "");
  const ozetKapali = bas?.querySelector(".ap-ozet")?.textContent ?? "";
  await tik(rozet("ajanda"));
  const ajandaAcik = durum("ajanda").acik && e.acikMi("ajanda") && /açık/.test(rozet("ajanda")?.textContent ?? "");
  kontrol("K3 rozete tıklamak ajandayı kapatır (defter + rozet + özet) ve tekrar açar", ajandaKapali && ajandaAcik && ozetKapali !== ozet, `kapalıyken özet="${ozetKapali}"`);

  // ── K4 ──
  dok.sifirla(); await bekle(150);
  await tik(rozet("panel-outliner"));
  const menuSatiri = () => dok.menuSatirlari().find((s): s is Exclude<typeof s, string> => typeof s !== "string" && s.etiket === "Outliner");
  const kapaliPasif = !e.acikMi("panel-outliner") && menuSatiri()?.etkin?.() === false;
  dok.sec("outliner"); await bekle(250);
  const acilmadi = !dok.ekrandaMi("outliner");
  await tik(rozet("panel-outliner"));
  dok.sec("outliner"); await bekle(300);
  const geriGeldi = e.acikMi("panel-outliner") && menuSatiri()?.etkin?.() === true && dok.ekrandaMi("outliner");
  kontrol("K4 panel eklentisi kapanınca panel gizli (Pencere satırı pasif, açılmaz); açınca geri gelir", kapaliPasif && acilmadi && geriGeldi, `pasif=${kapaliPasif} açılmadı=${acilmadi} geri=${geriGeldi}`);
  dok.kapat("outliner");

  // ── K5 ──
  await tik(rozet("flash"));
  const f = durum("flash");
  const rozetMetni = rozet("flash")?.textContent ?? "";
  kontrol("K5 yeniden_baslat (Flash): kapatınca 'kapanacak · yeniden başlat'; çalışan hâl DEĞİŞMEZ (calisiyor=true)", !f.acik && f.bekleyen && f.calisiyor && /kapanacak/.test(rozetMetni), `acik=${f.acik} bekleyen=${f.bekleyen} calisiyor=${f.calisiyor} rozet="${rozetMetni}"`);
  await ss("02_flash_bekleyen");
  await tik(rozet("flash"));
  kontrol("K5b geri açınca bekleyen kalkar", durum("flash").acik && !durum("flash").bekleyen);

  // ── K6 düşünme kipi: aç → seçenek → şema başlığı → kapat ──
  if (dusunme) {
    const baslik = () => document.getElementById("ayarPaneli")?.textContent ?? "";
    e.ac("dusunme-kipi"); e.secenekYaz("dusunme-kipi", "cozucu");
    const a = durum("dusunme-kipi");
    const secimYazildi = a.acik && a.calisiyor && a.secenek === "cozucu";
    e.secenekYaz("dusunme-kipi", "dogrulayici");
    const b2 = durum("dusunme-kipi");
    e.kapat("dusunme-kipi");
    const k = durum("dusunme-kipi");
    kontrol("K6 düşünme kipi: açılır, seçenek (Çözücü/Doğrulayıcı) yazılır, kapanınca varsayılana döner", secimYazildi && b2.secenek === "dogrulayici" && !k.acik && baslik().length > 0, `acik=${a.acik} calisiyor=${a.calisiyor} secenek=${a.secenek}→${b2.secenek} kapaliSonra=${!k.acik}`);
  }

  // ── temizlik: varsayılana dön ──
  for (const x of e.durum()) if (x.bildirim.varsayilan === "acik" && !x.acik) e.ac(x.bildirim.id);
  d.ayarKapat();
  bitir();
}
