# Dış Beyin — beyni başka bir dilde koşturmak (Spec v1)

> Karar tarihi: 2026-09-16 · Sahip: Ozyn · Yönetici: Orion (Claude Code)
> Durum: **uygulandı ve canlıda kanıtlandı** — tez testi Python beyniyle geçti.

## Soru

"Bir şeyleri yanlış yapıyoruz. Sanal dünya Babylon'da; ajanın sistemini önce
Python'da yapsak, çalıştırsak?"

## Cevap: ayrım zaten vardı, eksik olan taşıyıcıydı

`bridge/beyin.ts` baştan beri üç metotluk bir arayüz:

```ts
export interface Beyin {
  readonly ad: string;
  hazirMi(): Promise<boolean>;
  dusun(girdi: BeyinGirdisi): Promise<BeyinCikti>;
}
```

`protocol/` klasörünün **sıfır dış bağımlılığı** var; köprü beynin kim
olduğunu bilmez. Üç uygulama zaten vardı: `ollama.ts` (HTTP), `opencode.ts`
(HTTP), testte sahte bir tane.

Eksik olan tek şey, **kendi yazdığın bir sürece** bağlanan taşıyıcıydı.
`bridge/disBeyin.ts` o boşluğu doldurur.

## Sözleşme

Dil fark etmez — Python, Go, Rust, C. Şunu karşılayan her şey beyin olabilir:

```
GET  /saglik  → 200
POST /dusun   → gövde: BeyinGirdisi (JSON)
                yanıt: { metin?, cagrilar?: [{ad, girdi}], bilgi? }
```

Girdi **olduğu gibi** gider: talimat, dünya durumu, özetler, anılar, geçmiş ve
araç listesi. Dış beyin neyi kullanacağına kendi karar verir — taşıyıcı, beynin
işine karışmaz.

## Kanıt

`tools/ornek-beyin.py` — bağımlılıksız (yalnızca stdlib), ~200 satır.
Tez testi bu beyinle koşuldu:

```
[BEYIN] dis:127.0.0.1:4700  hazir=true
[BEYIN→NIYET] {"tur":"komut","metin":"git","gerekce":"'gti' tanınmadı; ..."}
[ONAY] ONAYLANDI (degistirir): git   → komut terminalde çalıştı
[TEZDENE] GECTI
```

Çalıştırma: `3dorion.bat pybeyin` (Python'u ayrı pencerede açar), ya da elle
`python tools/ornek-beyin.py` + `ORION_BEYIN=dis`.

## Soyutlamanın kazancı burada görünüyor

Dış beyin `cagrilar`ı **doğrudan yapısal** döner. Satır sözleşmesi
(`KOMUT:` / `TAHTA:` / `BAK:`) yalnızca bir LLM'e metin yazdırıp geri
ayrıştırmak zorunda olduğumuz için var. Yerel bir süreç o zahmete girmez.

Yani aynı dünya, aynı protokol, aynı onay kapısı — iki tamamen farklı beyin
türü. Arayüz bunu bedavaya verdi.

## Dış süreç GÜVENİLMEZDİR

Başka bir dilde, başka bir süreçte koşuyor: çökebilir, yarım JSON dönebilir,
hiç dönmeyebilir. 11 test bunları kapsıyor — bozuk çağrılar ayıklanır,
sağlamlar kalır; zaman aşımı anlamlı mesaj verir; `hazirMi` sunucu yokken
patlamaz. İÇERİK doğrulaması burada YAPILMAZ: o köprünün işi
(`cagriyiNiyete`) ve iki yerde doğrulamak ikisinin ayrışmasına davetiyedir.

## Dil tercihi — ölçüm olmadan dil eklenmez

TypeScript'in darboğaz olduğunu gösteren tek bir ölçüm yok. Bugünkü gerçek
darboğazlar sağlayıcı kotası ve Orion'un inisiyatif almaması; ikisi de dil
sorunu değil.

- **Python**: deneysel beyin işi için doğru yer (PyTorch/NumPy ekosistemi).
  Bu spec onu açıyor — rewrite olarak değil, **üçüncü beyin** olarak.
- **Rust**: ölçülmüş bir performans sorunu çıkarsa. "Sonra taşırız" pratikte
  neredeyse hiç olmaz; taşımayı ölçüm tetiklemeli.
- **Go**: "orkestra şefi" rolü için önerildi ama o işi `protocol/` + `bridge/`
  zaten yapıyor — olmayan bir soruna üçüncü dil.

## Sınır: bu, sıfırdan sinir ağı projesi DEĞİL

"Tek göz, tek kol, ışığa uzan" türü bir RL/nöron ağı ayrı bir projedir ve
3dorion'un tezine (*"AI'ın oturduğu oda — terminalini masasında açıyorsun"*)
bağlanmamalıdır: sıfırdan bir ağ terminal okuyamaz, kod yazamaz, konuşamaz.
Bu spec o projeyi de **mümkün kılar** (aynı sözleşmeyi karşılasın yeter) ama
onu 3dorion'un beynine dönüştürmeyi önermez.
