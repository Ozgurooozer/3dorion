# Orion / Brain IR - Compact Conversation Context

## 1. Proje

Orion icinde moduler bir Brain IR (computational brain intermediate representation) gelistiriliyor. Amac yalnizca neural-network simulator yapmak degil; beyin mimarilerini tasarlayan, deneyen, olcen ve zamanla ogrenebilen bir sistem kurmak.

Ana fikir:

> Brain IR, biyolojik baglanti fikrini hesaplanabilir dinamiklere ceviren ara katmandir.

Kanonik kaynak: `brain-lab/brain-ir/`

Eski paralel prototipler `brain-lab/archive/` altina alinmistir.

## 2. Brain IR v0.2 - Mevcut Durum

v0.2 bagimsiz ve mevcut `bridge/`, `mind/` ve `world/` koduna dokunmadan calisir.

Desteklenen kavramlar:

- node ve agirlikli edge grafigi
- state ve decay tabanli memory
- excitation ve inhibition
- recurrent dynamics
- decision/action threshold
- immutable `BrainTrace`
- causal node ve `OLY-*` event propagation
- deterministic replay
- reset
- Orion `Beyin` adapteri
- olay gunlugu ve `mind/Hafiza` ile olay hafizasi

Temel denklem:

```text
state(t+1) = state(t) * decay + excitation + inhibition
```

Test edilmis recurrent davranislar:

```text
weight = 1.0  -> stable
weight = 0.5  -> decaying
weight = -1.0 -> oscillating
weight = 1.2  -> unstable
```

Trace icerdigi bilgiler:

- previous state
- excitation
- inhibition
- raw state
- threshold
- activation
- causal node chain
- causal event IDs
- action node

Replay kaydi:

- seed
- initial state
- input sequence
- graph version
- node parameters

Dogrulanmis durum:

- Brain IR v0.2 ozel testleri: **21/21**
- Aktif repo testleri: **701/701**
- TypeScript typecheck: basarili
- Production build: mevcut onceki dogrulamalarda basarili
- Brain IR action ciktisi mevcut Orion intent validation yolundan geciyor

## 3. Mimari Yon Degisikligi

Brain IR'i yalnizca simulator olarak degil, beyin tasarlama ve kesfetme makinesi olarak ele aliyoruz.

Arastirilacak fonksiyon:

```text
structure + dynamics + memory -> behavior
```

Uzun vadeli dongu:

```text
WORLD
  -> observation
  -> BRAIN
  -> action
  -> WORLD
  -> outcome
  -> trace
```

Uclu mimari:

```text
Brain IR       = computational substrate
World          = embodied experiment environment
Jev / AI       = ilk asamada brain'in disinda analyzer / observer
```

AI ilk etapta karari ele geciren bir neuron olmamali. Brain trace'lerini yorumlayan, hipotez ureten ve yeni deney onerien bir gozlemci olmali.

Connectome da dogrudan kopyalanacak hedef degil, biyolojik prior/reference olarak kullanilmali:

```text
connectome -> biological prior -> Brain IR -> simulation -> behavior -> trace -> analysis
```

Uzun vadede hedef:

```text
desired behavior -> search / evolution -> candidate brain -> world -> behavior score
```

## 4. Dopamin Perspektifi

Dopamin yalnizca reward olarak modellenmemeli.

Daha uygun ilk soyutlama:

```text
dopamine ~= prediction error / teaching signal
```

Ornek:

```text
expected = 0.4
actual   = 0.9
error    = +0.5
```

ve:

```text
expected = 0.8
actual   = 0.2
error    = -0.6
```

Dopamin normal neuron olmak zorunda degil; global veya regional neuromodulator kanali olarak dusunulmeli:

```ts
type Neuromodulator = {
  dopamine: number;
  serotonin?: number;
  acetylcholine?: number;
};
```

Olası ilk plasticity soyutlamasi:

```text
DeltaWeight = learningRate
            * preActivation
            * postActivation
            * dopamine
```

Bu biyolojik gerceklik iddiasi degil, deneysel computational abstraction'dir.

## 5. OLY Event Memory'nin Yeni Rolu

`OLY-*` kayitlari yalnizca log olmamali. Bir deneyimin ogrenme girdisi olabilir:

```text
OLY-00000037
observation: food
action: approach
expected: 0.4
outcome: success
actual: 0.9
dopamine: +0.5
```

Olası akış:

```text
observation -> action -> outcome
-> prediction error / dopamine
-> plasticity
-> changed weights
-> future behavior
```

Olay gunlugu kaynak kayit, hafiza ise turetilmis indeks olmaya devam etmeli. Plasticity kalici degisiklik yapacaksa provenance ve replay bilgisi event'e baglanmali.

## 6. Brain IR v0.3 Icin Baslangic Noktasi

Bir sonraki surumde hemen AI adapteri veya buyuk connectome eklenmemeli.

Once deterministic experiment protocol kurulmasi daha guvenli:

```text
WorldState
Observation
Action
Outcome
Episode
ExperimentSpec
Prediction
DopamineSignal
PlasticityRule
```

Onerilen gelisim sirasi:

1. Kucuk deterministic world
2. observation -> Brain input cevirisi
3. Brain output -> action cevirisi
4. world transition ve outcome
5. prediction degeri
6. dopamine / prediction error sinyali
7. trace ve `OLY-*` kaydi
8. En son kontrollu plasticity

Ilk world, 2D ve kucuk olabilir:

```text
food + threat + energy + movement
```

Homeostasis, salt reward'dan once gelmeli:

```text
move  -> energy - 0.01
food  -> energy + 0.30
danger -> damage / energy - 0.50
```

## 7. Bilinen Sinirlar

- Simulator deterministik; seed su an stochastic randomness degil replay kimligi.
- Runaway positive feedback icin state clamp yok.
- Otomatik stability classifier yok.
- `ai` node tipi IR contract icinde var, fakat model adapter yok.
- Brain IR henuz Orion production flow'una otomatik baglanmis degil.
- Buyuk graph performansi icin incoming-edge indexing ve secimli trace gerekli.
- Plasticity henuz uygulanmadi; once experiment protocol olculmeli.

## 8. Devam Sorusu

Kaldigimiz yer:

> Brain IR v0.3'te `Prediction`, `Outcome`, `DopamineSignal` ve `PlasticityRule` nesnelerini nasil tanimlayacagiz?

Ilk tasarim tercihi:

- dopamin global modulator olarak kalacak
- karar Brain IR'da kalacak
- AI/Jev ilk asamada dis gozlemci olacak
- world loop deterministic ve replay edilebilir olacak
- plasticity event ve trace provenance'i ile izlenebilir olacak
