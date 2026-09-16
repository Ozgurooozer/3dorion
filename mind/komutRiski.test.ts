// mind/komutRiski.test.ts
"use strict";
import { test } from "node:test";
import assert from "node:assert/strict";
import { komutRiski, riskEtiketi } from "./komutRiski.ts";

test("salt-okunur komutlar 'okur' sayılır", () => {
  for (const k of ["ls -la", "dir", "git status", "npm test", "npx tsc --noEmit", "ollama list"]) {
    assert.equal(komutRiski(k).seviye, "okur", k);
  }
});

test("silme ve geri alınamaz işler YIKICI", () => {
  for (const k of ["rm -rf node_modules", "rmdir /s /q dist", "git reset --hard",
                   "git push --force origin main", "del /q *.log", "shutdown /s"]) {
    assert.equal(komutRiski(k).seviye, "yikici", k);
  }
});

test("kurulum ve depo değişikliği DEGISTIRIR", () => {
  for (const k of ["npm install express", "git commit -m x", "curl https://x/y -o z",
                   "mkdir yeni", "echo a > dosya.txt"]) {
    assert.equal(komutRiski(k).seviye, "degistirir", k);
  }
});

test("TANINMAYAN komut zararsız sayılmaz — bilgilendirmede güvenli taraf", () => {
  const r = komutRiski("acayip_bir_arac --calistir");
  assert.equal(r.seviye, "degistirir");
  assert.match(r.nedenler.join(" "), /tanınmayan/i);
});

test("zincirleme komut AÇIKÇA bildirilir — ikinci komut gözden kaçmasın", () => {
  const r = komutRiski("npm test && rm -rf dist");
  assert.equal(r.seviye, "yikici", "zincirdeki yıkıcı komut baskın olmalı");
  assert.match(r.nedenler.join(" "), /zincirlenmiş/);
});

test("zararsız görünen zincir bile zincir olduğunu söyler", () => {
  const r = komutRiski("ls && pwd");
  assert.equal(r.seviye, "degistirir");
  assert.match(r.nedenler.join(" "), /zincirlenmiş/);
});

test("gerekçeler boş bırakılmaz — onay ekranı sebep göstermeli", () => {
  for (const k of ["ls", "rm -rf x", "npm i", "bilinmeyen"]) {
    assert.ok(komutRiski(k).nedenler.length > 0, k);
  }
});

test("riskEtiketi tek satır ve seviyeyi başta söyler", () => {
  assert.match(riskEtiketi(komutRiski("rm -rf x")), /^YIKICI:/);
  assert.match(riskEtiketi(komutRiski("ls")), /^okur:/);
});

test("boş komut zararsız sayılmaz", () => {
  assert.notEqual(komutRiski("   ").seviye, "okur");
});

test("PowerShell silme YIKICI sayilir — kabuk PowerShell'e gecti", () => {
  // Bu desen ilk surumde YOKTU: liste Unix/cmd odakliydi ve PowerShell'in en
  // yaygin silme komutu yalnizca "degistirir" cikiyordu. Kabuk degisiminin
  // yan etkisiydi; kendi testim ortaya cikardi.
  for (const k of ["Remove-Item -Recurse -Force dist",
                   "Get-ChildItem . -Recurse | Remove-Item -Force",
                   "Clear-Content notlar.txt"]) {
    assert.equal(komutRiski(k).seviye, "yikici", k);
  }
});

test("SINIR: bu bir guvenlik siniri DEGIL — kacirdigi ornek belgeleniyor", () => {
  // Bu test bir KUSURU kilitler, yetenegi degil. Kodlanmis komutun icini
  // goremeyiz; siniflandirici onu "taninmayan" sayar, "yikici" demez.
  // Amac onay ekranini BILGILENDIRMEK; engellemek DEGIL. Gercek sinir
  // Ozyn'in tusudur ve bu bilinerek kabul edilmistir.
  const kodlanmis = komutRiski("powershell -enc cgBtACAALQByAGYAIAAuAA==");
  assert.notEqual(kodlanmis.seviye, "yikici",
    "kodlanmis komutun ici gorulemez - belgelenmis sinir");
  assert.match(kodlanmis.nedenler.join(" "), /tanınmayan/i);
});
