// brain-lab/viewer/guide.ts — every word and number the lab pages show, explained once, in Turkish, for the
// person running the lab: what it is, how to read it, what is good, and why we aim for it. The pages link
// their labels here (guide.html#<id>) and show `short` as a hover hint; a test checks every link resolves.
"use strict";

export interface Term {
  readonly id: string;
  readonly term: string;
  /** One sentence, shown as a hover hint next to the label. */
  readonly short: string;
  /** The full explanation (plain text; paragraphs separated by blank lines). */
  readonly long: string;
  /** How to read the number: its range and which way is good. */
  readonly read?: string;
  /** What we aim for, and why. */
  readonly target?: string;
}

export interface Section {
  readonly id: string;
  readonly title: string;
  readonly intro: string;
  readonly terms: readonly Term[];
}

export interface MealReference { readonly who: string; readonly perK: number; readonly survival: number | null; readonly note: string }

/** A room's reference points: hand-written or classic bodies measured on that room's evaluation rooms, seeds 1–10. */
export interface RoomReferences {
  readonly room: { readonly food: number; readonly threats: number; readonly energy: number };
  readonly name: string;
  readonly refs: readonly MealReference[];
}

const BLIND = "10 tiklik rastgele hareket patlamaları; hiçbir şey görmez. Yalnız hareket etmek bu kadarını getirir.";
const AHEAD = "kör patlamalar + 'yemek tam öndeyse ileri git'. S1n'in öğrendiği kararın elle yazılmış hali.";
const SEEKER = "elle yazılmış: gördüğü yemeğe döner ve gider, görmezse kör patlamalar. Tavan.";

/**
 * Reference points for meals per 1000 ticks per room (LAB-DEFTERI.md: series 003a, T0 and 005b calibration).
 * Room 1 shows the problem Ozyn saw: blind wandering plus "food ahead → forward" comes near the ceiling there,
 * so the room never asked the brain to turn. Room 3 (scarce) is where blind movement dies.
 */
export const MEAL_REFERENCES: readonly RoomReferences[] = [
  {
    room: { food: 10, threats: 0, energy: 0.4 }, name: "Oda 1 (10 yemek, doğum enerjisi 0,4)",
    refs: [
      { who: "Rastgele hareket", perK: 0.67, survival: null, note: "her tik rastgele komut; alt sınır" },
      { who: "Yeni doğmuş beyin (öğrenmeden)", perK: 2.07, survival: null, note: "doğuştan yapı: açken kıpırdar, tokken dinlenir" },
      { who: "Kör gezgin", perK: 2.68, survival: 0.03, note: BLIND },
      { who: "TD öğrenicisi (ders kitabı)", perK: 8.38, survival: null, note: "aynı duyu, aynı beden, aynı ödülle 40 bölüm öğrenen klasik algoritma" },
      { who: "Önündeyse ileri (elle)", perK: 19.7, survival: 0.99, note: AHEAD },
      { who: "Arayıcı (tavan)", perK: 26.84, survival: 1, note: SEEKER },
    ],
  },
  {
    room: { food: 5, threats: 0, energy: 0.8 }, name: "Oda 3, kıt oda (5 yemek, doğum enerjisi 0,8)",
    refs: [
      { who: "Kör gezgin", perK: 1.43, survival: 0.01, note: BLIND },
      { who: "Önündeyse ileri (elle)", perK: 10.75, survival: 0.81, note: AHEAD },
      { who: "Arayıcı (tavan)", perK: 15.21, survival: 0.92, note: SEEKER },
    ],
  },
];

/** The reference points measured in a room, if any. */
export function referencesFor(room: { food: number; threats: number; energy: number }): RoomReferences | undefined {
  return MEAL_REFERENCES.find((r) => r.room.food === room.food && r.room.threats === room.threats && r.room.energy === room.energy);
}

const S = (id: string, title: string, intro: string, terms: Term[]): Section => ({ id, title, intro, terms });

export const GUIDE: readonly Section[] = [
  S("amac", "Ne yapıyoruz, neden?", "Projenin hedefi ve bu sayfaların neyi ölçtüğü.", [
    {
      id: "hedef",
      term: "Basamak 2 hedefi",
      short: "Beyin doğru kararı kendi deneyiminden öğrenmeli; koşullar değişince de.",
      long: "Beyne hiçbir davranış elle yazılmıyor. Beden aç doğuyor, odada yemek var; beyin yalnızca kendi bedeninden gelen iyi/kötü hissiyle (dopamin) neyin işe yaradığını öğrenmek zorunda.\n\nBu hedefi ölçülebilir parçalara böldük: (1) öğrenen denek, kendi hareketlerini kör tekrar eden bağlı bedeninden daha iyi yaşıyor mu (hareketsiz ikizi geçmek yetmez); (2) bu fark gerçekten öğrenmeden mi geliyor (çürütme kontrolleri); (3) doğru yöne karar veriyor mu (yönlendirme); (4) oda değişince (az/çok yemek, tehlike) de sürüyor mu; (5) klasik bir öğreniciyle (TD) ve ulaşılabilecek en iyiyle (tavan) kıyasla nerede.",
      target: "Beşi birden: bağlı bedenden anlamlı iyi, kontroller kazancı yok ediyor, yönlendirme belirgin şekilde 0'dan büyük, farklı odalarda da tutuyor, TD'yi geçiyor.",
    },
    {
      id: "bilim",
      term: "Neden bu kadar kontrol?",
      short: "Bir sonucu iddia etmeden önce onu çürütmeye çalışıyoruz.",
      long: "Öğrenen denek daha iyi yaşadı diye 'öğrendi' demek yetmez: şans, ölçüm hatası ya da öğrenmeyle ilgisiz bir yan etki olabilir. Bu yüzden her iddia için önce onu yıkabilecek deneyler koşuyoruz (ikiz, CROSS, LOCAL, lezyon, karıştırma). İddia ancak bunlardan sağ çıkarsa kabul ediliyor; olumsuz sonuçlar da deftere yazılıyor.",
    },
  ]),
  S("dunya", "Oda, beden, denek", "Deneylerin geçtiği yer ve kimler üzerinde yapıldığı.", [
    {
      id: "oda",
      term: "Oda",
      short: "10×10 metrelik kapalı alan; yemekler (yeşil) ve bazen tehlike bölgeleri (kırmızı).",
      long: "Fiziği olan, tamamen belirlenimci bir oda: aynı seed her seferinde bit bit aynı odayı ve aynı olayları üretir. Yemek yenince başka bir yerde yenisi çıkar. Oda 1'de 10 yemek var, tehlike yok; oda 2'de ayrıca 2 tehlike bölgesi var (içinde kalan beden yaralanır). Oda 3 (kıt oda) 5 yemekli ve beden 0,8 enerjiyle doğar: orada kör dolaşan beden ölür (%1 yaşar), görüşünü kullanan yaşar; bu yüzden öğrenmeyi sınamak için kullanıyoruz.",
    },
    {
      id: "beden",
      term: "Beden ve duyular",
      short: "Bir daire; 5 ışınla görür, çarpmayı ve kendi açlığını/yarasını hisseder.",
      long: "Beden ileri/geri itebilir ve sola/sağa dönebilir. Görmesi 5 ışınla: 60° sağ, 30° sağ, tam ön, 30° sol, 60° sol; her ışın 5 metreye kadar ne gördüğünü (duvar, yemek, tehlike) ve ne kadar yakın olduğunu söyler. Ayrıca çarpma, açlık, yara ve kendi hareketini hisseder. Beyin dünyayı yalnızca bunlardan bilir.",
    },
    {
      id: "aclik",
      term: "Açlık ve tokluk (enerji)",
      short: "Enerji 1 = tam tok, 0 = açlıktan ölüm. Beden aç doğar: oda 1'de 0,4, kıt odada 0,8 enerjiyle.",
      long: "Her an biraz enerji harcanır, hareket ederken daha fazla. Bir yemek +0,3 enerji verir. Enerji 0'a inerse beden ölür ve o oda biter.",
      read: "0–1 arası; yüksek iyi.",
    },
    {
      id: "tik",
      term: "Tik, oda (bölüm)",
      short: "Tik = 0,05 saniyelik bir an. Bir oda (bölüm) en fazla 3000 tik = 150 saniye sürer.",
      long: "Beyin her tikte duyuları alır ve bir hareket seçer. Bir bölüm, bedenin bir odada doğup en fazla 3000 tik yaşaması demek; ölürse erken biter.",
    },
    {
      id: "denek",
      term: "Denek (DNK-…)",
      short: "Numaralı, adı olan tek bir beyin; doğumundan itibaren her değişikliği kayıtlı.",
      long: "Her beyin bir denektir: numarası (DNK-2747), bir adı («Doruk 58»), doğum seed'i, grubu ve soyu vardır. Beyninde değişen her bağlantı deftere tek tek yazılır; doğum grafiği + defter, beynin bugünkü halini birebir yeniden kurar. Bu sayfada izlediğin beyin de o defterden kurulur.",
    },
    {
      id: "ikiz",
      term: "İkiz (kontrol)",
      short: "Öğrenenle aynı doğan ama hiç öğrenmeyen beyin; kıyasın temeli.",
      long: "Her öğrenen deneğin bir ikizi var: aynı seed'le, aynı yapıyla doğar ve aynı odalarda ölçülür, ama öğrenmesi kapalıdır. Böylece öğrenenle ikizi arasındaki fark yalnızca öğrenmenin etkisidir: doğuştan gelen yetenek, şans ya da odanın kolaylığı ikisinde de aynıdır.",
      target: "İkizi geçmek gerekli ama yetmez: ikiz çoğunlukla kıpırdamadığı için onu geçmek yalnızca 'hareket etmeyi öğrendi' demek olabilir. Asıl ölçü bağlı beden.",
    },
    {
      id: "bagli",
      term: "Bağlı beden (kör kontrol)",
      short: "Öğrenenin kendi hareketlerini başka bir odada, gözü kapalı tekrar oynayan beden.",
      long: "Nörobilimdeki 'yoked control'. Bağlı beden, öğrenenin bir odada yaptığı hareketlerin aynısını (aynı miktar, aynı patlamalar, aynı duraklamalar) başka bir odada yapar; ama gördüğü şeyle hiçbir bağı yoktur. Neden gerekli: yemek bol olan bir odada dolaşan her beden yemeğe çarpar (Ozyn: 'rastgele motor bile yeterince çalışınca yemek yiyebiliyor'). Öğrenen yalnızca hareket etmeyi öğrendiyse, bağlı bedeni kadar iyi olur. Ondan iyiyse gördüğünü ya da hissettiğini gerçekten kullanıyordur.\n\nİlk ölçüm (seri 005a): S1n bağlı bedenini geçiyor, çünkü yemek tam önündeyken ileri gitmeyi öğrenmiş; ama yana dönüşleri yemeğe göre rastgele.",
      target: "Öğrenen, bağlı bedeninden anlamlı tok yaşamalı (p < 0,05) ve yemek yandayken o tarafa bağlı bedeninden sık dönmeli.",
    },
    {
      id: "grup",
      term: "Reflekssiz / refleksli",
      short: "İki doğum grubu: refleksliler iki zayıf doğuştan refleksle doğar.",
      long: "Refleksli grupta beyin, çarpınca sola dönme ve yaralanınca ileri kaçma eğilimiyle doğar (öğrenmeyle silinebilir). Reflekssizde bunlar yok. Hangisinin daha iyi öğrendiğini veri söylesin diye ikisi de ölçülür.",
    },
    {
      id: "egitim",
      term: "Eğitim ve değerlendirme",
      short: "40 odada öğrenir, sonra öğrenmesi dondurulup 10 yeni odada ölçülür.",
      long: "Eğitimde beyin 40 bölüm yaşar ve öğrenir. Sonra öğrenme kapatılır ve daha önce görmediği 10 değerlendirme odasında ölçülür. Tablolardaki sayılar bu 10 odadan gelir. Deney Odası'nda izlediğin de tam bu 10 oda.",
    },
    {
      id: "seed",
      term: "Seed (ayar ve test)",
      short: "Rastgeleliği belirleyen sayı. 1–20 ayar içindir; 1001+ yalnız ön-kayıtlı resmi test için.",
      long: "Aynı seed aynı doğumu ve aynı odaları verir, bu yüzden her deney tekrarlanabilir. Ayarlar yalnızca 1–20 arası seed'lerde yapılır. 1001 ve üstü, kriterleri önceden dondurulmuş (ön-kayıt) resmi test içindir; onlarla ayar yapılmaz, yoksa sonuç kendini kandırır.",
    },
  ]),
  S("olculer", "Ölçüler: hangi sayı ne anlatıyor", "Tablolarda ve grafiklerde gördüğün her sayı.", [
    {
      id: "durtu",
      term: "Ortalama dürtü",
      short: "Bedenin ne kadar 'kötü' hissettiği: açlık ve yaranın bileşimi. Düşük = iyi yaşıyor.",
      long: "Dürtü, bedenin iç dengesinden ne kadar uzak olduğudur: tam tok ve yarasızken 0, aç ya da yaralıyken yükselir. Değerlendirme odalarındaki her tikin ortalaması alınır; ölen beden odanın geri kalanında son dürtüsünde sayılır (ölüm ceza olarak içinde).\n\nNeden ana ölçü bu? Çünkü öğrenmenin kaynağı da bu: dopamin, dürtünün azalmasından doğuyor. 'Az yemek ama hiç acıkmadan yaşamak' da iyi yaşamaktır; yemek sayısı bunu cezalandırır, dürtü cezalandırmaz.",
      read: "0–1 arası. Düşük iyi. İkizlerde tipik değer ~0,85 (aç ve çoğu zaman ölü).",
      target: "İkizinden anlamlı düşük (p < 0,05). Ne kadar düşükse o kadar iyi; 0,2'nin altı bedenin çoğunlukla tok yaşadığı demek.",
    },
    {
      id: "hayatta",
      term: "Hayatta kalma",
      short: "Değerlendirme odalarının yüzde kaçında beden 3000 tikin sonuna kadar yaşadı.",
      long: "Her oda için beden sona kadar yaşadıysa 1, açlıktan ya da yaradan öldüyse 0; yüzdesi alınır.",
      read: "%0–%100. Yüksek iyi.",
    },
    {
      id: "yemek",
      term: "Yemek / 1000 tik",
      short: "Bin tikte (50 saniyede) kaç yemek yendi. Yemek bulma becerisinin ölçüsü.",
      long: "Toplam yenen yemek / toplam yaşanan tik × 1000. Yaşanan süreye göre ölçeklenir, erken ölen beden kısa ömründe ne yaptıysa o sayılır.\n\nKarşılaştırma noktaları (aynı odalar, ölçüldü): rastgele hareket 0,67 · yeni doğmuş beyin 2,07 · TD öğrenicisi 8,38 · kusursuz arayıcı 25,8.",
      read: "0 ve üstü. Yüksek iyi, ama tek başına yetmez: tok bir beden dinlenir ve az yer.",
      target: "Önce TD'yi (8,38) geçmek: aynı imkanlarla ders kitabı algoritmasından iyi olmak. Uzun vadede tavana (25,8) yaklaşmak.",
    },
    {
      id: "yonelme",
      term: "Yemeğe yönelme",
      short: "Yemek görüş alanındayken ona doğru hareketi yapma oranı (öndeyse ileri, yandaysa o tarafa dönme).",
      long: "Yemeğin görüldüğü her an için, beden yemeğe doğru hareketi yaptı mı? Yemek tam öndeyse ileri gitmek, yandaysa o tarafa dönmek 'doğru hareket' sayılır. Yönlendirmeden farkı: yönlendirme yalnızca yana dönüşlere bakar ve alışkanlığı ayıklar; yönelme 'önündeyse ileri'yi de sayar.\n\nSeri 005a: S1n'in yönelmesi bağlı bedeninin iki katı (0,33'e 0,17), ama bunun neredeyse tamamı 'önündeyse ileri'den geliyor; yönlendirme şansta.",
      read: "0–1 arası. Yüksek iyi. Anlamı ancak bağlı bedenle kıyasta: kör hareket de bazen tesadüfen doğru hareketi yapar.",
      target: "Bağlı bedeninden anlamlı yüksek; yönlendirmeyle birlikte artmalı.",
    },
    {
      id: "yonlendirme",
      term: "Yönlendirme",
      short: "Yemek soldayken sola, sağdayken sağa dönme eğilimi. 0 = yön yok, 1 = kusursuz.",
      long: "Yemek sol ışınlardayken sola dönme olasılığı ile sağa dönme olasılığının farkı, ve aynısı sağ için; ikisinin ortalaması. Bir beden hiç yöne bakmadan hep sola dönse bile 0 çıkar, çünkü yemek sağdayken de sola dönüyordur. Yani bu ölçü alışkanlığı değil, yöne verilen kararı ölçer.",
      read: "−1 ile 1 arası. 0 = yemeğin tarafı dönüşü etkilemiyor. 1 = her zaman yemeğe döner. Negatif = yemekten kaçar.",
      target: "Belirgin şekilde 0'ın üstünde (ikizden anlamlı yüksek). Yalnız öğretmenden öğrenen deney (T1only) 0,24'e çıktı, yani bu beyinle mümkün; kendi başına öğrenen S1n'de henüz 0,05 (şans düzeyi). Bu, şu an çözmeye çalıştığımız asıl sorun.",
    },
    {
      id: "bilgi",
      term: "Bilgi (bit)",
      short: "Yemeğin hangi tarafta olduğu, bedenin dönüşünü ne kadar belirliyor.",
      long: "Yemeğin tarafı (sol/sağ) ile dönüş yönü (sol/sağ) arasındaki ortak bilgi. Yönlendirmeyle aynı soruyu bilgi kuramıyla soruyor: dönüşe bakarak yemeğin tarafını ne kadar tahmin edebilirsin?",
      read: "0–1 bit. 0 = hiç ilişki yok; 1 = dönüş, yemeğin tarafını tam gösteriyor.",
      target: "0'dan belirgin büyük; yönlendirmeyle birlikte artmalı.",
    },
    {
      id: "zarar",
      term: "Zarar / 1000 tik",
      short: "Tehlike bölgelerinde alınan yara, bin tik başına. Tehlikesiz odada hep 0.",
      long: "Yalnızca tehlike bölgeli odalarda (oda 2) anlamlı. Beden tehlikeden uzak durmayı öğrenirse düşer.",
      read: "0 ve üstü. Düşük iyi.",
    },
    {
      id: "iyi-sayisi",
      term: "Öğrenen iyi (k/n)",
      short: "n denekten kaçında öğrenen, kendi ikizinden daha düşük dürtüyle yaşadı.",
      long: "Her denek kendi ikiziyle karşılaştırılır. 10'da 9 gibi yüksek bir oran, farkın birkaç şanslı denekten değil, genelden geldiğini gösterir.",
      read: "n'nin yarısı şans düzeyidir.",
    },
    {
      id: "p",
      term: "p değeri (Wilcoxon)",
      short: "Bu fark tesadüfen çıkmış olabilir mi? Küçük p = tesadüf olma ihtimali düşük.",
      long: "Her deneğin ikizinden farkı alınır; bu farkların sıfırdan sistematik olarak ayrılıp ayrılmadığını Wilcoxon işaretli sıralar testi söyler. Eşleştirilmiş test kullanıyoruz çünkü her denek kendi ikiziyle kıyaslanıyor: aynı doğum, aynı odalar. p, gerçekte hiçbir etki yokken bu kadar büyük bir farkın şansla çıkma olasılığıdır.",
      read: "0–1. p < 0,05 geleneksel 'anlamlı' eşiği; p < 0,01 güçlü. p büyükse 'fark yok' değil, 'fark gösterilemedi' demektir.",
      target: "Öğrenme iddiası için p < 0,05 ve doğru yönde fark; kontrollerde ise kazancın kaybolduğunu gösteren küçük p.",
    },
  ]),
  S("kontroller", "Kontroller ve çürütme", "Bir kazancın gerçekten öğrenmeden geldiğini sınamanın yolları.", [
    {
      id: "cross",
      term: "CROSS kontrolü",
      short: "Dopamin 3000 tik geciktirilir: öğrenme yanlış anlara bağlanır. Kazanç kaybolmalı.",
      long: "Beyin aynı ödül sinyallerini alır, ama 3000 tik gecikmeli (bir oda boyu; sinyal çoğu zaman önceki odadan gelir). Yani 'iyi oldu' sinyali, o iyiliği getiren hareketle değil ilgisiz bir anla eşleşir. Öğrenme gerçekse ve zamanlamaya dayanıyorsa, kazanç bu kontrolde yok olmalı.",
      target: "CROSS'ta öğrenen, ikiz seviyesine düşmeli. Düşmüyorsa kazanç öğrenmeden değil başka bir şeyden geliyor demektir.",
    },
    {
      id: "local",
      term: "LOCAL kontrolü",
      short: "Dopamin aynı oda içinde 200 tik geciktirilir. Kazanç yine kaybolmalı.",
      long: "CROSS'tan daha ince bir sınama: ödüller aynı odadan, ama 10 saniye kaymış. Genel 'bu oda iyiydi' bilgisi korunur, anlık 'bu hareket iyiydi' bilgisi bozulur.",
      target: "Kazanç yok olmalı: beyin anlık sebep-sonuçtan öğreniyorsa gecikme onu bozar.",
    },
    {
      id: "lezyon",
      term: "Lezyon",
      short: "Öğrenilmiş bağlantıların bir kısmını doğum değerine döndürüp tekrar ölçmek.",
      long: "Beyin cerrahisindeki mantık: bir bölgeyi çıkarınca ne bozuluyorsa o bölge onu yapıyordur. Örneğin yalnız 'yemek ışınları'ndan öğrenilenleri silince kazanç düşerse, kazanç oradan geliyordur. 'Öğrenilen her şey' lezyonu deneği ikiz seviyesine döndürmeli.",
    },
    {
      id: "karistirma",
      term: "Karıştırma (SHUFFLED)",
      short: "Öğrenilen değişiklikler bağlantılar arasında rastgele dağıtılır.",
      long: "Toplam öğrenme miktarı aynı kalır, hangi bağlantının değiştiği bozulur. Kazanç düşerse öğrenmenin doğru bağlantılara yerleştiği anlaşılır (S1n'de kazancın ~%60'ı bağlantıya özgü çıktı).",
    },
    {
      id: "tazeseed",
      term: "Taze seed doğrulaması",
      short: "Ayarı yapılan seed'lerde bulunan sonuç, hiç kullanılmamış seed'lerde tekrar ölçülür.",
      long: "Bir koşulu 1–10 seed'lerinde bulduk ve beğendiysek, 11–20'de tekrar koşarız. Sonuç orada da çıkıyorsa ayara özgü bir tesadüf değildir. S1n'in 'yön öğreniyor' iddiası burada çürüdü; 'daha iyi yaşıyor' iddiası ayakta kaldı.",
    },
  ]),
  S("beyin", "Beynin parçaları", "Beynin nasıl kurulduğu ve neyin öğrendiği.", [
    {
      id: "gitgitme",
      term: "Git / Gitme (bazal ganglion)",
      short: "Her hareket için bir 'yap' ve bir 'yapma' hücresi; ikisinin çekişmesi kararı verir.",
      long: "Gerçek beyindeki bazal ganglionun basit modeli. Her hareketin (ileri, geri, sol, sağ) bir Git ve bir Gitme hücresi var. Duyulardan bu hücrelere giden bağlantılar öğrenir: iyi sonuçlanan bir hareketin Git'i güçlenir, kötü sonuçlananın Gitme'si. Isı haritasında gördüğün değer (Git değişimi − Gitme değişimi) tam olarak budur: pozitif = bu duyu bu hareketi yaptırıyor, negatif = frenliyor.",
    },
    {
      id: "dopamin",
      term: "Dopamin",
      short: "Beklenenden iyi → pozitif, kötü → negatif öğretme sinyali.",
      long: "Bedenin dürtüsü azalınca (yemek yendi) iyi bir sonuç doğar. Dopamin, sonucun beklentiden farkıdır: beklenmedik iyilik büyük pozitif, beklenen iyilik küçük, hayal kırıklığı negatif. Öğrenme bu sinyalle, az önce aktif olan bağlantılarda olur.",
    },
    {
      id: "elestirmen",
      term: "Eleştirmen",
      short: "Bir durumun ne kadar iyi olduğunu tahmin etmeyi öğrenen parça (örneğin 'yemek görüyorum').",
      long: "Eleştirmen, 'şu an gördüğüm şey birazdan iyi bir şey getirir mi' tahminini öğrenir. Böylece yemeği görmek bile hafif bir ödül olur ve beden yemeğe dönmeyi, yemeği henüz yemeden öğrenebilir. Şu anki sorunumuz: eleştirmen yemek görmeye neredeyse sıfır değer veriyor (binde birler düzeyinde), bu yüzden doğru yöne dönmek ödüllenmiyor.",
      target: "Yemek ışınlarında belirgin pozitif değer. Bu olmadan yön öğrenilemiyor.",
    },
    {
      id: "ogretmen",
      term: "Öğretmen",
      short: "Elle yazılmış bir 'doğru hareket' bilgisini ek öğretme sinyali olarak veren deney düzeni.",
      long: "Bir teşhis aracı, hedef değil: beyin 'doğru yönü' öğrenebilir mi, yoksa beyin yapısı buna izin vermiyor mu? Yalnız öğretmenle (T1only) yönlendirme 0,24'e çıktı, 10 denekten 10'unda; yani yapı yeterli; eksik olan, bu sinyali beynin kendi içinden üretmek.",
    },
    {
      id: "secim",
      term: "Rekabetçi seçim",
      short: "Her an hareketler yarışır, en güçlü olan kazanır (S1).",
      long: "Önceki tasarımda seçim eşikliydi ve sık sık hiçbir hareket seçilmiyordu. S1 ile her an Git−Gitme dengesi en güçlü olan hareket seçiliyor (ya da dinlenme). Bu, 'ne zaman hareket, ne zaman dinlen' öğrenmesini mümkün kıldı.",
    },
  ]),
  S("kosullar", "Deney kodları", "Tablolardaki kısa kodların anlamı.", [
    { id: "E7", term: "E7", short: "Temel öğrenme kuralı (eski seçimle).", long: "Seçilen harekete bağlı üç faktörlü öğrenme, eleştirmen, ölümden öğrenmeme. S serisinin öncesi." },
    { id: "S1", term: "S1", short: "E7 + rekabetçi seçim.", long: "Hareketler her an yarışıyor. İlk kez beden ikizinden belirgin iyi yaşamaya başladı." },
    { id: "S1n", term: "S1n", short: "S1, olumsuz dopamin tabanı kaldırılmış; şu an en iyi kendi başına öğrenen beyin.", long: "Kötü sonuçlardan da tam güçle öğrenir. Bağlı bedenini geçiyor (taze seed'lerde dürtüde 16/20): yemek tam önündeyken ileri gitmeyi ve açken hareket edip tokken durmayı öğrenmiş. Ama yemek yandayken o tarafa dönmüyor; dönüşleri yemeğe göre rastgele. İzlerken 'rastgele dolaşıyor' görünmesinin sebebi bu." },
    { id: "K1n", term: "K1n", short: "S1n, kıt odada (5 yemek, enerji 0,8).", long: "Rastgelenin kazanamadığı odada S1n: odaların %39'unda hayatta kalıyor (bağlı bedeni %7, ikizi %0). Ama elle yazılmış 'önündeyse ileri' kuralı aynı odada %81 yaşıyor; beyin bu basit kuralın bile çok altında." },
    { id: "KT1", term: "KT1", short: "Kıt odada, yalnız öğretmenden öğrenen S1n.", long: "Teşhis: %72 hayatta, yemeğe dönme 10 denekten 10'unda. Aynı beyin yapısı yönü taşıyabiliyor; eksik olan, bu öğretme sinyalini beynin kendi içinden üretmek." },
    { id: "T1only", term: "T1only", short: "S1n, yalnız öğretmenden öğrenir (ödül yok).", long: "Teşhis: öğretmen sinyali tek başına yeterli mi? Evet: yönlendirme 0,24, 10 denekten 10'unda; yemek/1000 tik 17,2." },
    { id: "T1add", term: "T1add", short: "S1n, ödül + öğretmen birlikte.", long: "Teşhis: öğretmen ödüle eklenince yön öğreniliyor mu? Kısmen: yönlendirme 0,18, 10 denekten 8'inde; ödül sinyali öğretmeninkiyle yarışıyor." },
    { id: "R1n", term: "R0 / R1 / R1n", short: "Aynı koşullar, tehlike bölgeli odada (oda 2).", long: "Koşullar değişince öğrenmenin sürüp sürmediğini ve tehlikeden kaçınmanın öğrenilip öğrenilmediğini sınar." },
  ]),
];

/** Every term by id, for hover hints and links. */
export const TERMS: ReadonlyMap<string, Term> = new Map(GUIDE.flatMap((s) => s.terms.map((t) => [t.id, t] as const)));

export const guideLink = (id: string) => `guide.html#${id}`;
