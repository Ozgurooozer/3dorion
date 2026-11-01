// bridge/kopruCikti.ts — Bir düşünme turunun ÇIKTISININ işlenmesi (kopru.ts'ten ayrıldı, kalite turu 2026-11-02; mantık ve sıra AYNI): düz metin → iç ses, araç çağrıları → doğrulama →
// beden/söz niyeti, düz metinden kurtarma, eylem sırası, "söyledi ama yapmadı" bekçisi. Köprü durumu `CiktiBaglami` ile dar bir yüzden verilir (köprünün özel alanları dışarı çıkmaz).
"use strict";
import type { Niyet } from "../protocol/niyet.ts";
import { kimlik } from "../protocol/temel.ts";
import { niyetKaydi, type UyanisBilgisi } from "../mind/kararKaydi.ts";
import { sozEylemUcurumu } from "../mind/sozEylem.ts";
import { ingilizceMi } from "../mind/dilSecimi.ts";
import { cagriyiNiyete } from "./araclar.ts";
import type { BeyinCikti, BeyinGirdisi } from "./beyin.ts";
import { kancaDogrula, type KancaBaglami } from "./kopruKancalari.ts";
import { metinKurtar } from "./metinKurtarma.ts";
import type { EylemSirasi } from "./eylemSirasi.ts";
import { SOZ_NIYETLERI } from "./kopruTurleri.ts";
import type { KopruAyari, KopruSayaci, TurCiktisi } from "./kopruTurleri.ts";

/** Çıktı işleyicinin köprüden gördüğü yüz: yalnız gerekenler (durum köprüde kalır). */
export interface CiktiBaglami {
  readonly ayar: KopruAyari;
  readonly sayac: KopruSayaci;
  readonly sira: EylemSirasi;
  /** Reddedilen çağrının geri beslemesi: tampona özet + kimliği `null` (algı değil). İkisi hep birlikte itilir. */
  tamponaEkle(ozet: string): void;
  kancaBaglami(): KancaBaglami;
  /** Geçerli çağrı geldi: ardışık ret (düzeltme döngüsü kalkanı) sıfırlanır. */
  ardisikRetSifirla(): void;
  sozuGecir(metin: string): boolean;
  konusmaDinleyiciVar(): boolean;
  konusmaYay(metin: string): void;
  gecmiseEkle(k: BeyinGirdisi["gecmis"][number]): void;
  kirp(): void;
  ortamOgrenmeyiHazirla(uyanis: UyanisBilgisi, beden: TurCiktisi["beden"]): void;
  gonder(n: Niyet, id: string): void;
}

/**
 * Bir düşünme turunun ÇIKTISI (spec 14 R2: `_dusun`'dan ayrıldı, mantık aynı): düz metin,
 * araç çağrıları, düz metinden kurtarma, beden niyetleri (eylem sırası), iç ses ve
 * "söyledi ama yapmadı" bekçisi.
 */
/**
 * `sunulan`: bu turda modele SUNULAN araç adları. Sözleşme yalnız listede değil burada da uygulanır: özerk turda
 * (`OZERK_ARACLAR`) sunulmayan `dunya_komut`/`dunya_sor` yapısal ya da metin içinde çağrılınca dünyaya gidiyordu
 * (2026-10-13 sondası). Sunulmayan çağrı reddedilir ve modele geri beslenir; metinden yalnız sunulanlar kurtarılır.
 */
export function ciktiyiIsle(k: CiktiBaglami, cikti: BeyinCikti, uyanis: UyanisBilgisi, sessiz: boolean, istekler: string[], sunulan: ReadonlySet<string>): void {
  // Düz metin DUYULMAZ — protokolde konuşmak bir eylemdir (dunya_soyle).
  //
  // GEÇMİŞE DE YAZILMAZ (spec 13). Eskiden "modelin kendi düşüncesi bağlamda
  // kalsın" diye `assistant` metni olarak yazılıyordu. Ölçüm (2026-10-02, taban):
  // ortak testin gerçek geçmişiyle qwen2.5:7b 40 komutun 0'ında araç çağırdı ve
  // geçmişteki kendi düz metnini taklit etti ("ortalığı kontrol ediyorum…").
  // Düz metin artık İÇ SES: kayda ve zihin duvarına gider, geçmişe gitmez.
  if (cikti.metin) {
    // Düz metin DUYULMAZ. Model araç çağırmak yerine sohbet ediyorsa bu
    // SESSİZ bir davranış hatasıdır — kullanıcı Orion'u susmuş sanır.
    // Görünür olsun ki ölçülebilsin.
    console.log(`[BEYIN:metin] ${cikti.metin.slice(0, 160)}${cikti.cagrilar.length === 0 ? "  ← ARAÇ YOK, bu duyulmayacak" : ""}`);
    k.ayar.metinDinle?.(cikti.metin, cikti.cagrilar.length > 0);
  }

  const tur: TurCiktisi = { sessiz, sozler: [], icSes: [], beden: [] };
  // Düşünen API modelinin ayrı gelen akıl yürütmesi (`reasoning_content`, bridge/apiBeyni.ts)
  // İÇ SESTİR: sesli okunmaz, geçmişe girmez, duvarda görünür (spec 13 Faz 5).
  const akil = cikti.bilgi?.["dusunce"];
  if (typeof akil === "string" && akil.trim()) tur.icSes.push(akil.trim());
  // Araç ÇAĞIRDIYSA düz metin eyleme eşlik eden iç düşüncedir.
  if (cikti.metin && cikti.cagrilar.length > 0) tur.icSes.push(cikti.metin);

  for (const c of cikti.cagrilar) {
    // Sunulmayan araç: sayılır ama modele GERİ BESLENMEZ — geri besleme yeni bir tur açar ve özerk turun
    // "zincir 0"ını, gordum turunun "sor yok"unu delip bakış döngüsünü geri getirirdi. Model aracı görmüyordu.
    if (!sunulan.has(c.ad)) {
      k.sayac.reddedilenCagri++;
      uyanis.reddedilen++;
      console.warn(`[kopru] sunulmayan arac reddedildi: ${c.ad}`);
      continue;
    }
    const d = cagriyiNiyete(c.ad, c.girdi);
    if (!d.ok) {
      k.sayac.reddedilenCagri++;
      uyanis.reddedilen++;
      // Reddi sessizce yutma: modele geri besle, kendini düzeltsin.
      k.tamponaEkle(`Araç reddedildi (${c.ad}): ${d.hata}`);
      console.warn(`[kopru] çağrı reddedildi: ${d.hata}`);
      continue;
    }
    // EKLENTİ DOĞRULAYICISI (spec 40): doğrulanmış niyet dünyaya gitmeden kancalarca sınanır; ret mevcut ret yolundan modele geri beslenir.
    const kd = kancaDogrula(k.ayar.kancalar?.() ?? [], d.deger, k.kancaBaglami());
    if (!kd.ok) {
      k.sayac.reddedilenCagri++;
      uyanis.reddedilen++;
      uyanis.kancaReddi = (uyanis.kancaReddi ?? 0) + 1;
      k.tamponaEkle(`Araç reddedildi (${c.ad}): ${kd.neden}`);
      console.warn(`[kopru] kanca reddetti (${kd.kanca}): ${kd.neden}`);
      continue;
    }
    k.ardisikRetSifirla();  // geçerli çağrı geldi, düzeltme döngüsü kırıldı
    niyetiIsle(k, d.deger, uyanis, tur);
  }

  // ── Düz metin kurtarma ──────────────────────────────────────────────
  // Kural: düz metin DUYULMAZ (konuşmak bir eylemdir). Ama model HİÇ araç
  // çağırmadıysa o metin başka bir şey olamaz — söylemek istediği şeydir.
  // Sessizce yutmak, Orion'u kullanıcı gözünde bozuk gösterir.
  //
  // ÖLÇÜMDEN DOĞDU: canlı davranış denemesinde Orion gerçek bir kabuk
  // hatasını doğru teşhis etti ("Terminal'da yanlış bir komut girildi")
  // ama `dunya_soyle` çağırmadı; kullanıcı hiçbir şey duymadı.
  //
  // Araç ÇAĞIRDIYSA metin kurtarılmaz: o zaman metin eyleme eşlik eden
  // iç düşüncedir ve seslendirilmesi gürültü olur.
  if (cikti.cagrilar.length === 0 && cikti.metin) {
    // GERCEK HATA (ekran goruntusu, 2026-09-13): model arac cagrilarini
    // duz metin olarak yazdi (`orld {"name": "dunya_bak", ...}`) ve bu
    // kurtarma onu OLDUGU GIBI seslendirdi; kullanici JSON dinledi.
    //
    // Artik once ICINDEN ARAC CAGRILARI KURTARILIR (hatayi eyleme
    // cevirmek sesli okumaktan iyidir), sonra yalnizca temiz cumle
    // konusulur. Kurtarilamayan arac copu ASLA duyulmaz.
    const { cagrilar: kurtarilan, konusulabilir } = metinKurtar(cikti.metin, [...sunulan]);

    for (const c of kurtarilan) {
      const d = cagriyiNiyete(c.ad, c.girdi);
      if (!d.ok) { console.warn(`[kopru] metinden kurtarilan cagri gecersiz: ${d.hata}`); continue; }
      k.sayac.kurtarilanCagri++;
      uyanis.kurtarilan++;
      console.warn(`[kopru] METINDEN kurtarildi: ${c.ad}`);
      niyetiIsle(k, d.deger, uyanis, tur);
    }

    if (konusulabilir && (sessiz || ingilizceMi(konusulabilir)) && k.sozuGecir(konusulabilir)) {
      // Hareket zinciri: kurtarılan cümle de iç seste kalır. İngilizce düz metin de
      // (Ozyn'in testi, 2026-10-02: lfm25-tb'nin "I see the user is asking…" iç
      // monoloğu sesli okundu): Orion'un sesi Türkçedir, İngilizce çerçevenin dilidir.
      tur.icSes.push(konusulabilir);
    } else if (konusulabilir && k.konusmaDinleyiciVar() && k.sozuGecir(konusulabilir)) {
      const metin = konusulabilir.slice(0, 400);
      k.sayac.kurtarilanMetin++;
      uyanis.konusulanMetin = true;
      console.warn(`[kopru] arac cagrilmadi, temiz metin konusmaya cevrildi: "${metin.slice(0, 80)}"`);
      k.konusmaYay(metin);
      // Söylendi: geçmişe SÖZ olarak girer (düz metin olarak değil — bkz. yukarı).
      k.gecmiseEkle({ rol: "orion", metin, arac: true });
      k.kirp();
      tur.sozler.push(metin);
    } else if (!konusulabilir && kurtarilan.length === 0) {
      k.sayac.yutulanCop++;
      console.warn(`[kopru] arac copu KONUSULMADI: "${cikti.metin.slice(0, 80)}"`);
    }
  }

  // Öğrenen ortam sözlüğü: sonuçlar eylem sırası başlarken SENKRON gelebilir, bu yüzden bekleme ÖNCE kurulur.
  k.ortamOgrenmeyiHazirla(uyanis, tur.beden);

  // Beden niyetleri: tek niyet hemen, birden çoğu sırayla (bkz. EylemSirasi).
  k.sira.baslat(tur.beden);

  if (tur.icSes.length) {
    uyanis.icSes = tur.icSes.join(" / ");
    if (sessiz) uyanis.susturan = "kopru.hareket_sessiz";
    console.log(`[kopru] iç ses${sessiz ? " (hareket zinciri, kopru.hareket_sessiz)" : ""}: "${uyanis.icSes.slice(0, 120)}"`);
    try { k.ayar.icSesDinle?.(uyanis.icSes); }
    catch (err) { console.error("[kopru] iç ses dinleyicisi hatası:", err); }
  }

  // SÖYLEDİ AMA YAPMADI (mind/sozEylem.ts): yalnız gözlem, davranış değişmez.
  const eksik = sozEylemUcurumu(tur.sozler, uyanis.niyetler.map((n) => n.tur), istekler);
  if (eksik.length) {
    uyanis.sozEylemUcurumu = eksik;
    const soz = tur.sozler.join(" ");
    console.warn(`[kopru] SOZ-EYLEM: "${soz.slice(0, 80)}" dedi ama ${eksik.join(", ")} niyeti yok`);
    try { k.ayar.sozEylemDinle?.(eksik, soz); }
    catch (err) { console.error("[kopru] söz-eylem dinleyicisi hatası:", err); }
  }
}

/**
 * Doğrulanmış bir niyeti turun çıktısına işler (model çağrısı ve metinden kurtarılan
 * çağrı aynı yoldan geçer). Söz hemen konuşulur (ya da hareket zincirinde iç seste
 * kalır); `sor` hemen gider; beden niyetleri toplanır, tur sonunda sıraya girer.
 */
export function niyetiIsle(k: CiktiBaglami, n: Niyet, uyanis: UyanisBilgisi, tur: TurCiktisi): void {
  const id = kimlik("n");
  if (n.tur === "soyle") {
    // Düşen söz dünyaya da GİTMEZ: `niyetGonder` de atlanır.
    if (!k.sozuGecir(n.metin)) { uyanis.yutulanSoz++; return; }
    if (tur.sessiz) { tur.icSes.push(n.metin); return; }
    if (k.konusmaDinleyiciVar()) {
      k.konusmaYay(n.metin);
      k.gecmiseEkle({ rol: "orion", metin: n.metin, arac: true });
      k.kirp();
    }
    tur.sozler.push(n.metin);
  }
  // Gövdesiyle (spec 10, Faz A): beceri refleksi görevin nasıl yapıldığını buradan öğrenir.
  uyanis.niyetler.push(niyetKaydi(id, n));
  k.sayac.niyet++;
  if (SOZ_NIYETLERI.has(n.tur)) { k.gonder(n, id); return; }
  // Beden niyeti geçmişe ARAÇ olarak girer (spec 13): model "komut → eylem" görsün.
  const { tur: nt, ...girdi } = n;
  k.gecmiseEkle({ rol: "orion", metin: "", arac: true, cagri: { ad: `dunya_${nt}`, girdi } });
  k.kirp();
  tur.beden.push({ niyet: n, id });
}
