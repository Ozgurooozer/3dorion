// mind/hafizaGocu.test.ts — localStorage → dosya göçü veri kaybetmemeli.
//
// NAİF ÇÖZÜMDEN ÖNCE yazıldı (spec 07 Faz 1, K5). Hedeflenen çöküşler:
//   - göç yazımı başarısız olur ama eski veri yine de "taşındı" sayılır
//   - dosya yazılır ama doğrulanmaz; eksik yazılmış dosya asıl kaynak olur
//   - dosya zaten varken eski depo onu ezer (iki hafıza yarışır)
//   - bozuk dosya "boş hafıza" sayılır
//   - eski depo silinir → geri dönüş yolu kalmaz
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { depoYukle, type DosyaDurumu } from "./hafizaGocu.ts";

/** Sahte G/Ç: dosya ve eski depo bellekte, her çağrı kaydedilir. */
function duzenek(opt: {
  dosya?: DosyaDurumu;
  eski?: unknown[];
  yazimBasarili?: boolean;
  /** Yazımdan sonra okunan kayıt sayısını boz — "eksik yazıldı" durumu. */
  dogrulamadaEksik?: boolean;
}) {
  let dosya: DosyaDurumu = opt.dosya ?? { durum: "yok" };
  const eski = opt.eski ?? [];
  const cagri: string[] = [];
  const io = {
    dosyaOku(): DosyaDurumu {
      cagri.push("dosyaOku");
      return dosya;
    },
    dosyaYazSenkron(k: unknown[]): boolean {
      cagri.push(`dosyaYaz(${k.length})`);
      if (opt.yazimBasarili === false) return false;
      dosya = { durum: "var", kayitlar: opt.dogrulamadaEksik ? k.slice(1) : [...k] };
      return true;
    },
    eskiOku(): unknown[] {
      cagri.push("eskiOku");
      return eski;
    },
  };
  return { io, cagri, eski };
}

const A = [{ metin: "bir" }, { metin: "iki" }, { metin: "üç" }];

test("dosya VARSA o kazanır — eski depoya bakılmaz bile", () => {
  const { io, cagri } = duzenek({ dosya: { durum: "var", kayitlar: [{ metin: "dosyadaki" }] }, eski: A });
  const s = depoYukle(io);
  assert.equal(s.kaynak, "dosya");
  assert.deepEqual(s.kayitlar, [{ metin: "dosyadaki" }]);
  assert.ok(!cagri.includes("eskiOku"), "dosya varken eski depo okundu — iki hafıza yarışır");
  assert.ok(!cagri.some((c) => c.startsWith("dosyaYaz")), "dosya varken üzerine yazıldı");
});

test("GÖÇ: dosya yok, eski depoda N kayıt → dosyaya N yazılır, N döner", () => {
  const { io, cagri } = duzenek({ eski: A });
  const s = depoYukle(io);
  assert.equal(s.kaynak, "goc");
  assert.deepEqual(s.kayitlar, A);
  assert.ok(cagri.includes("dosyaYaz(3)"), `yazim cagrisi: ${cagri.join(" ")}`);
});

test("GÖÇ DOĞRULANIR: yazım sonrası dosya yeniden okunup sayılır", () => {
  const { io, cagri } = duzenek({ eski: A });
  depoYukle(io);
  const yazIdx = cagri.findIndex((c) => c.startsWith("dosyaYaz"));
  assert.ok(cagri.slice(yazIdx + 1).includes("dosyaOku"), "yazdıktan sonra dosya okunmadı — doğrulama yok");
});

test("GÖÇ YAZIMI BAŞARISIZ → eski veri döner, 'taşındı' sayılmaz", () => {
  const { io } = duzenek({ eski: A, yazimBasarili: false });
  const s = depoYukle(io);
  assert.equal(s.kaynak, "eski-yedek");
  assert.deepEqual(s.kayitlar, A, "yazım başarısızken hafıza kayboldu");
});

test("GÖÇ EKSİK YAZILDI → dosyaya güvenilmez, eski veri döner", () => {
  const { io } = duzenek({ eski: A, dogrulamadaEksik: true });
  const s = depoYukle(io);
  assert.equal(s.kaynak, "eski-yedek", "eksik yazılmış dosya asıl kaynak oldu");
  assert.deepEqual(s.kayitlar, A);
});

test("BOZUK dosya boş hafıza sayılmaz → eski depodan göç denenir", () => {
  const { io } = duzenek({ dosya: { durum: "bozuk", tasindi: "x.bozuk.json" }, eski: A });
  const s = depoYukle(io);
  assert.deepEqual(s.kayitlar, A, "bozuk dosya yüzünden hafıza boş sanıldı");
  assert.match(s.not ?? "", /bozuk/, "bozukluk sessizce yutuldu");
});

test("ESKİ DEPO SİLİNMEZ — göçten sonra hâlâ okunabilir (geri dönüş yolu)", () => {
  const { io, eski } = duzenek({ eski: A });
  depoYukle(io);
  // Yapısal garanti: G/Ç'de silme yeteneği YOK. Bu test onun kanıtı.
  assert.ok(!("eskiSil" in io), "G/Ç arayüzüne silme yeteneği eklenmiş");
  assert.deepEqual(eski, A);
});

test("OKUMA HATASI göçü TETİKLEMEZ — dosyanın üstüne asla yazılmaz", () => {
  // Main, dosyayı okuyamadığında (izin, kilit) `hata` döner. Bunu "yok"
  // sanıp göçe düşersek eski localStorage verisi GERÇEK dosyanın üstüne
  // yazılır: geçici bir okuma hatası kalıcı veri kaybına dönüşür.
  const { io, cagri } = duzenek({ dosya: { durum: "hata", mesaj: "EACCES" }, eski: A });
  const s = depoYukle(io);
  assert.ok(!cagri.some((c) => c.startsWith("dosyaYaz")),
    `okuma hatasinda dosyaya yazildi: ${cagri.join(" ")}`);
  assert.equal(s.kaynak, "eski-yedek");
  assert.deepEqual(s.kayitlar, A, "okuma hatasinda hafiza bos sanildi");
  assert.match(s.not ?? "", /EACCES/, "hata sessizce yutuldu");
});

test("her yer boşsa boş döner, gereksiz dosya yazılmaz", () => {
  const { io, cagri } = duzenek({});
  const s = depoYukle(io);
  assert.deepEqual(s.kayitlar, []);
  assert.equal(s.kaynak, "bos");
  assert.ok(!cagri.some((c) => c.startsWith("dosyaYaz")), "boş hafıza için dosya yazıldı");
});
