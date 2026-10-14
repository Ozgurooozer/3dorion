// world/level/gi/isikHacmiGlsl.ts — Işık Hacmi'nin GPU geçişleri (GLSL ES 3.0, WebGL2). Her biri `isikHacmiCekirdek.ts`teki
// CPU referansının AYNISINI yapar; sayılar `HACIM`dan şablona gömülür (tek kaynak; bekçi: isikHacmi.test.ts).
//
// Geçişler (her kare, tam ekran dörtgen → atlas dokusu; sahne çizimi YOK):
//   ENJEKSIYON  statik atlaslar + ışık dizisi + önceki ışınım → L0 ışıma (dolu voxel: albedo × ışık + ışıma)
//   MIP         L(k) → L(k+1), 2 × 2 × 2 ortalama (3 geçiş)
//   TOPLAMA     L0..L3 → 6 yönlü ışınım atlası (dolu + yüzey-yakını voxelde yön başına bir koni)
//   MALZEME     (giEklentisi.ts) pikselde ortam küpü: 3 yön × 2 okuma
// Not: GLSL dizgelerinde ters eğik çizgi YOK (proje kuralı: Windows'ta kaçış kazası).
"use strict";
import { HACIM, IRR_BLOK, KONI_SETI } from "./isikHacmiCekirdek.ts";

/** GLSL float yazımı (1 → "1.0"). */
export const f = (x: number) => (Number.isInteger(x) ? x.toFixed(1) : String(x));

/** Atlas çözümü ve örnekleme (her geçişte ve malzemede ortak). `n` = hücre sayısı, `sutun` = karo sütunu. */
export const ORTAK_GLSL = `
ivec2 hTek(ivec3 n, int sutun, ivec3 c) { return ivec2((c.y % sutun) * n.x + c.x, (c.y / sutun) * n.z + c.z); }
bool hDisinda(ivec3 n, ivec3 c) { return any(lessThan(c, ivec3(0))) || any(greaterThanEqual(c, n)); }
vec4 hUc(sampler2D t, vec3 n, float sutun, vec2 ofs, vec2 boyut, vec3 g) {
  if (any(lessThan(g, vec3(0.0))) || any(greaterThan(g, n))) return vec4(0.0);
  vec3 c = g - 0.5;
  float jf = clamp(c.y, 0.0, n.y - 1.0);
  float j0 = floor(jf);
  float fy = jf - j0;
  float j1 = min(j0 + 1.0, n.y - 1.0);
  vec2 xz = clamp(c.xz, vec2(0.0), n.xz - 1.0) + 0.5;
  vec2 a = ofs + vec2(mod(j0, sutun) * n.x, floor(j0 / sutun) * n.z) + xz;
  vec2 b = ofs + vec2(mod(j1, sutun) * n.x, floor(j1 / sutun) * n.z) + xz;
  return mix(texture(t, a / boyut), texture(t, b / boyut), fy);
}
`;

/** Tam ekran geçişlerinin başı: hedef atlastaki teksel → voxel. */
const BAS = `
precision highp float;
precision highp int;
varying vec2 vUV;
`;

export const ENJEKSIYON_GLSL = `${BAS}
uniform sampler2D statik0;
uniform sampler2D statik1;
uniform sampler2D isimaTablo;
uniform sampler2D oncekiIrr;
uniform vec4 hN;
uniform vec4 hAt;
uniform vec4 hKoken;
uniform vec4 hAyar;
uniform vec4 isikA[${HACIM.isikSiniri}];
uniform vec4 isikB[${HACIM.isikSiniri}];
uniform vec4 isikC[${HACIM.isikSiniri}];
uniform vec4 isikD[${HACIM.isikSiniri}];
${ORTAK_GLSL}
ivec3 iN;
int iSutun;

float gorunurluk(vec3 p, vec3 yon, float uzunluk) {
  for (int s = 0; s < ${HACIM.golgeMaks}; s++) {
    float t = float(s) * ${f(HACIM.golgeAdimi)};
    if (t >= uzunluk) break;
    ivec3 c = ivec3(floor(p + yon * t));
    if (hDisinda(iN, c)) return 1.0;
    if (texelFetch(statik0, hTek(iN, iSutun, c), 0).a > 0.5) return 0.0;
  }
  return 1.0;
}

vec3 irrNokta(ivec3 c, int b) {
  ivec2 ofs = ivec2((b % ${IRR_BLOK.sutun}) * int(hAt.z + 0.5), (b / ${IRR_BLOK.sutun}) * int(hAt.w + 0.5));
  return texelFetch(oncekiIrr, ofs + hTek(iN, iSutun, c), 0).rgb;
}

void main(void) {
  iN = ivec3(hN.xyz + 0.5);
  iSutun = int(hAt.x + 0.5);
  ivec2 px = ivec2(gl_FragCoord.xy);
  int tx = px.x / iN.x;
  int ty = px.y / iN.z;
  int j = ty * iSutun + tx;
  if (tx >= iSutun || j >= iN.y) { gl_FragColor = vec4(0.0); return; }
  ivec3 c = ivec3(px.x - tx * iN.x, j, px.y - ty * iN.z);
  vec4 s0 = texelFetch(statik0, px, 0);
  if (s0.a < 0.5) { gl_FragColor = vec4(0.0); return; }
  vec4 s1 = texelFetch(statik1, px, 0);
  vec3 N = s1.xyz * 2.0 - 1.0;
  bool nVar = length(N) > 0.3;
  N = nVar ? normalize(N) : vec3(0.0);
  vec3 p = vec3(c) + 0.5;
  float voxel = hKoken.w;
  vec3 d = vec3(0.0);
  for (int l = 0; l < ${HACIM.isikSiniri}; l++) {
    if (float(l) >= hAyar.z) break;
    vec4 A = isikA[l];
    vec4 B = isikB[l];
    vec4 C = isikC[l];
    vec4 D = isikD[l];
    int tur = int(A.w + 0.5);
    vec3 L;
    float uzunluk;
    float siddet = 1.0;
    vec3 renk = C.rgb;
    if (tur == 0 || tur == 2) {
      vec3 q = (A.xyz - hKoken.xyz) / voxel;
      vec3 dv = q - p;
      float dl = length(dv);
      siddet = max(0.0, 1.0 - dl * voxel / C.w);
      if (siddet <= 0.0) continue;
      L = dl > 0.0 ? dv / dl : vec3(0.0, 1.0, 0.0);
      if (tur == 2) {
        float cs = -dot(L, B.xyz);
        if (cs < B.w) continue;
        siddet *= pow(max(cs, 0.0), D.w);
      }
      uzunluk = dl - ${f(HACIM.armaturPayi)};
    } else if (tur == 1) {
      L = -B.xyz;
      uzunluk = ${f(HACIM.golgeMaks)};
    } else {
      L = B.xyz;
      uzunluk = ${f(HACIM.golgeMaks)};
      float h = nVar ? 0.5 + 0.5 * dot(N, B.xyz) : 0.5;
      renk = mix(D.rgb, C.rgb, h);
    }
    float ndl = tur == 3 ? 1.0 : (nVar ? max(0.0, dot(N, L)) : 1.0);
    if (ndl <= 0.0) continue;
    vec3 o = nVar ? N : L;
    float g = gorunurluk(p + o * ${f(HACIM.golgeOfset)}, L, min(uzunluk, ${f(HACIM.golgeMaks)}));
    if (g <= 0.0) continue;
    d += renk * (siddet * ndl * g);
  }
  if (hAyar.y > 0.0) {
    vec3 e;
    if (nVar) {
      vec3 n2 = N * N;
      e = n2.x * irrNokta(c, N.x >= 0.0 ? 0 : 1) + n2.y * irrNokta(c, N.y >= 0.0 ? 2 : 3) + n2.z * irrNokta(c, N.z >= 0.0 ? 4 : 5);
    } else {
      e = (irrNokta(c, 0) + irrNokta(c, 1) + irrNokta(c, 2) + irrNokta(c, 3) + irrNokta(c, 4) + irrNokta(c, 5)) / 6.0;
    }
    d += hAyar.y * e;
  }
  int mi = int(s1.a * 255.0 + 0.5);
  vec3 em = texelFetch(isimaTablo, ivec2(mi, 0), 0).rgb;
  gl_FragColor = vec4(s0.rgb * d + em, 1.0);
}
`;

/** Kaynak seviye (kN, kSutun) → hedef (hN, hSutun); 8 hücrenin ortalaması, kenarda kenar tekrar. */
export const MIP_GLSL = `${BAS}
uniform sampler2D kaynak;
uniform vec4 kN;
uniform vec4 hN;
${ORTAK_GLSL}
void main(void) {
  ivec3 n = ivec3(hN.xyz + 0.5);
  int sutun = int(hN.w + 0.5);
  ivec3 kn = ivec3(kN.xyz + 0.5);
  int ks = int(kN.w + 0.5);
  ivec2 px = ivec2(gl_FragCoord.xy);
  int tx = px.x / n.x;
  int ty = px.y / n.z;
  int j = ty * sutun + tx;
  if (tx >= sutun || j >= n.y) { gl_FragColor = vec4(0.0); return; }
  ivec3 c = ivec3(px.x - tx * n.x, j, px.y - ty * n.z);
  vec4 s = vec4(0.0);
  for (int dj = 0; dj < 2; dj++) for (int dk = 0; dk < 2; dk++) for (int di = 0; di < 2; di++) {
    ivec3 q = min(c * 2 + ivec3(di, dj, dk), kn - 1);
    s += texelFetch(kaynak, hTek(kn, ks, q), 0);
  }
  gl_FragColor = s * 0.125;
}
`;

/** Hedef: 3 × 2 bloklu ışınım atlası (blok b = yön, `YONLER` sırası). */
export const TOPLAMA_GLSL = `${BAS}
uniform sampler2D statik0;
uniform sampler2D statik1;
uniform sampler2D seviye0;
uniform sampler2D seviye1;
uniform sampler2D seviye2;
uniform sampler2D seviye3;
uniform vec4 mipN[${HACIM.mipSayisi}];
uniform vec4 mipBoyut[${HACIM.mipSayisi}];
uniform vec4 hKoni;
${ORTAK_GLSL}

vec4 seviyeUc(int L, vec3 q0) {
  float k = exp2(float(L));
  vec3 g = q0 / k;
  vec4 m = mipN[L];
  vec2 b = mipBoyut[L].xy;
  if (L == 0) return hUc(seviye0, m.xyz, m.w, vec2(0.0), b, g);
  if (L == 1) return hUc(seviye1, m.xyz, m.w, vec2(0.0), b, g);
  if (L == 2) return hUc(seviye2, m.xyz, m.w, vec2(0.0), b, g);
  return hUc(seviye3, m.xyz, m.w, vec2(0.0), b, g);
}

vec4 seviyeOrnekle(vec3 q0, float lvl) {
  int a = int(floor(lvl));
  float fr = lvl - float(a);
  int b = min(a + 1, ${HACIM.mipSayisi - 1});
  vec4 x = seviyeUc(a, q0);
  if (fr <= 0.0 || b == a) return x;
  return mix(x, seviyeUc(b, q0), fr);
}

vec3 koniIzle(vec3 p, vec3 yon, float baslangic) {
  vec3 c = vec3(0.0);
  float a = 0.0;
  float t = baslangic;
  for (int s = 0; s < 64; s++) {
    if (t >= ${f(HACIM.koniMaks)} || a >= ${f(HACIM.koniDoyma)}) break;
    float cap = max(1.0, 2.0 * t * ${f(HACIM.koniTan)});
    float lvl = min(log2(cap), ${f(HACIM.mipSayisi - 1)});
    vec4 o = seviyeOrnekle(p + yon * t, lvl);
    if (o.a > 0.0) {
      float ad = 1.0 - pow(1.0 - min(o.a, 0.999), exp2(lvl));
      float k = 1.0 - a;
      c += k * o.rgb * (ad / o.a);
      a += k * ad;
    }
    t += cap * ${f(HACIM.koniAdimOrani)};
  }
  return c;
}

void main(void) {
  vec4 m0 = mipN[0];
  ivec3 n = ivec3(m0.xyz + 0.5);
  int sutun = int(m0.w + 0.5);
  ivec2 blok = ivec2(mipBoyut[0].xy + 0.5);
  ivec2 px = ivec2(gl_FragCoord.xy);
  int bx = px.x / blok.x;
  int by = px.y / blok.y;
  int b = by * ${IRR_BLOK.sutun} + bx;
  ivec2 yer = px - ivec2(bx, by) * blok;
  int tx = yer.x / n.x;
  int ty = yer.y / n.z;
  int j = ty * sutun + tx;
  if (b > 5 || tx >= sutun || j >= n.y) { gl_FragColor = vec4(0.0); return; }
  ivec3 c = ivec3(yer.x - tx * n.x, j, yer.y - ty * n.z);
  vec4 s0 = texelFetch(statik0, yer, 0);
  vec4 s1 = texelFetch(statik1, yer, 0);
  bool dolu = s0.a > 0.5;
  if (!dolu && s1.r < 0.5) { gl_FragColor = vec4(0.0); return; }
  vec3 yon = b == 0 ? vec3(1.0, 0.0, 0.0) : b == 1 ? vec3(-1.0, 0.0, 0.0) : b == 2 ? vec3(0.0, 1.0, 0.0)
    : b == 3 ? vec3(0.0, -1.0, 0.0) : b == 4 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 0.0, -1.0);
  vec3 N = s1.xyz * 2.0 - 1.0;
  bool nVar = dolu && length(N) > 0.3;
  N = nVar ? normalize(N) : vec3(0.0);
  vec3 p = vec3(c) + 0.5;
  float bas = dolu ? ${f(HACIM.koniDoluBaslangic)} : ${f(HACIM.koniBaslangic)};
  vec3 r = vec3(0.0);
  if (!(nVar && dot(N, yon) < ${f(HACIM.arkaEsik)})) r += (hKoni.x < 1.5 ? 1.0 : ${f(KONI_SETI.merkez)}) * koniIzle(p, yon, bas);
  if (hKoni.x > 1.5) {
    vec3 yard = abs(yon.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 t1 = normalize(cross(yon, yard));
    vec3 t2 = cross(yon, t1);
    for (int k = 0; k < 5; k++) {
      float fi = float(k) * ${f((2 * Math.PI) / 5)};
      vec3 d = ${f(Math.cos(KONI_SETI.egim))} * yon + ${f(Math.sin(KONI_SETI.egim))} * (cos(fi) * t1 + sin(fi) * t2);
      if (nVar && dot(N, d) < ${f(HACIM.arkaEsik)}) continue;
      r += ${f(KONI_SETI.halka)} * koniIzle(p, d, bas);
    }
  }
  gl_FragColor = vec4(r, 1.0);
}
`;

/**
 * Malzeme eklentisinin okuma işlevi. Uniform'lar: giKoken (xyz köken, w voxel), giN (xyz hücre, w sütun),
 * giAt (x, y: L0 atlas boyu; z güç; w kip). Örnek yüzeyin `ornekOfset` voxel önünde, ortam küpü 3 yön.
 */
export const MALZEME_GLSL = `
${ORTAK_GLSL}
vec3 giYon(int b, vec3 g) {
  vec2 blok = giAt.xy;
  vec2 ofs = vec2(float(b % ${IRR_BLOK.sutun}), float(b / ${IRR_BLOK.sutun})) * blok;
  vec2 boyut = blok * vec2(${f(IRR_BLOK.sutun)}, ${f(IRR_BLOK.satir)});
  return hUc(giIrr, giN.xyz, giN.w, ofs, boyut, g).rgb;
}
vec3 giIsinim(vec3 p, vec3 n) {
  vec3 g = (p + n * (${f(HACIM.ornekOfset)} * giKoken.w) - giKoken.xyz) / giKoken.w;
  vec3 n2 = n * n;
  return n2.x * giYon(n.x >= 0.0 ? 0 : 1, g) + n2.y * giYon(n.y >= 0.0 ? 2 : 3, g) + n2.z * giYon(n.z >= 0.0 ? 4 : 5, g);
}
`;
