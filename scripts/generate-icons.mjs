// Gera os ícones PNG do SYSTEM sem nenhuma dependência.
// Desenha pixel a pixel com superamostragem 4x (antialiasing):
// fundo escuro + moldura de janela azul néon + diamante dourado + núcleo.
//
// Uso: node scripts/generate-icons.mjs
// Saída: public/icons/{icon-192,icon-512,maskable-512}.png

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(OUT, { recursive: true });

// ---------- PNG encoding ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // filtro 0 em cada linha
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- desenho ----------
const lerp = (a, b, t) => a + (b - a) * t;

// SDFs em espaço normalizado u,v ∈ [0,1], centro (0.5,0.5)
const rectDist = (u, v, half) => Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)) - half;
const diamondDist = (u, v, half) => Math.abs(u - 0.5) + Math.abs(v - 0.5) - half;
const circleDist = (u, v, r) => Math.hypot(u - 0.5, v - 0.5) - r;

const FRAME_HALF = 0.27; // moldura externa 0.23..0.77
const FRAME_THICK = 0.05;
const DIAMOND_HALF = 0.185;
const DIAMOND_THICK = 0.028;
const CORE_R = 0.052;
const GLOW = 0.11;

function sample(u, v) {
  const dFrame = rectDist(u, v, FRAME_HALF);
  const ring = Math.abs(dFrame) - FRAME_THICK / 2;

  const dDia = diamondDist(u, v, DIAMOND_HALF);
  const diaRing = Math.abs(dDia) - DIAMOND_THICK / 2;

  const dCore = circleDist(u, v, CORE_R);

  let r = 0x07, g = 0x07, b = 0x0d;

  // moldura azul
  if (ring < 0) {
    r = 0x3b; g = 0x4f; b = 0xd8;
  }
  // diamante dourado
  if (diaRing < 0) {
    r = 0xfa; g = 0xcc; b = 0x15;
  }
  // núcleo dourado
  if (dCore < 0) {
    r = 0xff; g = 0xe0; b = 0x4d;
  }
  // brilho aditivo perto das bordas
  const glow = (d) => (d < GLOW ? Math.exp(-(d / GLOW) * 6) * 0.55 : 0);
  let gr = 0, gb = 0, gg = 0;
  gr += glow(Math.min(Math.abs(ring), Math.abs(diaRing), Math.abs(dCore)) > 1e-6 ? Math.abs(ring) : 0);
  gr += glow(Math.abs(diaRing));
  gg += glow(Math.abs(dCore));
  // unifica: brilho azul da moldura
  const blueGlow = glow(Math.abs(ring));
  const goldGlow = glow(Math.min(Math.abs(diaRing), Math.abs(dCore)));
  r = Math.min(255, r + blueGlow * 79 + goldGlow * 250);
  g = Math.min(255, g + blueGlow * 142 + goldGlow * 204);
  b = Math.min(255, b + blueGlow * 247 + goldGlow * 21);
  void gr; void gb; void gg;

  return [r, g, b, 255];
}

function render(size) {
  const SS = size * 4; // superamostragem
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let j = 0; j < 4; j++) {
        for (let i = 0; i < 4; i++) {
          const u = (x * 4 + i + 0.5) / SS;
          const v = (y * 4 + j + 0.5) / SS;
          const [sr, sg, sb, sa] = sample(u, v);
          r += sr; g += sg; b += sb; a += sa;
        }
      }
      const idx = (y * size + x) * 4;
      px[idx] = Math.round(r / 16);
      px[idx + 1] = Math.round(g / 16);
      px[idx + 2] = Math.round(b / 16);
      px[idx + 3] = Math.round(a / 16);
    }
  }
  return encodePNG(size, size, px);
}

for (const [name, size] of [["icon-192", 192], ["icon-512", 512], ["maskable-512", 512]]) {
  writeFileSync(join(OUT, `${name}.png`), render(size));
  console.log(`✓ ${name}.png (${size}x${size})`);
}
