// tools/oda-olcu-json.ts — Odanın ölçülerini (world/level/olculer.ts) JSON olarak basar.
//
// Neden: Blender betiği (assets/kaynak/oda-esyalar.py) eşyaları bu sayılarla boyutlandırır.
// Sayılar Python'a elle kopyalansaydı masa kodda bir boyda, modelde başka boyda kalırdı
// (bu repo kopya kaymasını birkaç kez yaşadı). Tek kaynak olculer.ts; bu araç onu taşır.
//
// Kullanım: node --experimental-strip-types tools/oda-olcu-json.ts > <dosya>.json
"use strict";
import { ODA, MASA, MONITOR, SANDALYE, TAHTA, PENCERE, KAPI, SEMA, GUNLUK, ADMIN, BERJER, YIGIN, LAMBA, CAM_DUVARI, ISIKLIK } from "../world/level/olculer.ts";

export const OLCULER = { ODA, MASA, MONITOR, SANDALYE, TAHTA, PENCERE, KAPI, SEMA, GUNLUK, ADMIN, BERJER, YIGIN, LAMBA, CAM_DUVARI, ISIKLIK } as const;

if (import.meta.main) {
  process.stdout.write(JSON.stringify(OLCULER, null, 2) + "\n");
}
