// tools/babylon-cozucu.mjs — Babylon'u node testlerine açan çözücü kancası.
//
// SORUN: kaynak kod `@babylonjs/core/Cameras/freeCamera` diye UZANTISIZ import
// ediyor. Vite bunu çözüyor, node çözmüyor (ERR_MODULE_NOT_FOUND). Sonuç:
// Babylon'a dokunan hiçbir katman test edilemiyordu — kamera, oda, avatar.
//
// ÇÖZÜM: yalnızca `@babylonjs/*` alt yollarında, uzantısız isteğe `.js` ekle.
// Dar tutuldu bilerek: proje kodunun kendi importlarına KARIŞMAZ, yoksa
// gerçek bir yazım hatası sessizce düzeltilmiş olurdu.
//
// Kullanım: node --import ./tools/babylon-cozucu.mjs --test ...
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./babylon-cozucu-kanca.mjs", pathToFileURL("./tools/"));
