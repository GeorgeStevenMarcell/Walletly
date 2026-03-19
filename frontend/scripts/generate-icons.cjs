#!/usr/bin/env node
/**
 * Generate PNG icons from SVG sources for PWA compatibility.
 * Run: node frontend/scripts/generate-icons.js
 *
 * Requires no external dependencies — uses the built-in SVG-to-canvas approach
 * via a small inline renderer, or you can use any SVG-to-PNG tool.
 *
 * Since Node.js doesn't have native Canvas, this script generates simple
 * PNG icons procedurally using raw pixel data (no dependencies needed).
 */

const fs = require("fs");
const path = require("path");

const ICONS_DIR = path.join(__dirname, "..", "public", "icons");

// Minimal PNG encoder (no dependencies)
function createPNG(width, height, fillFn) {
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = fillFn(x, y, width, height);
      const i = (y * width + x) * 4;
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = a;
    }
  }

  // Build PNG file
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeBuffer = Buffer.from(type, "ascii");
    const crcData = Buffer.concat([typeBuffer, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcData) >>> 0);
    return Buffer.concat([len, typeBuffer, data, crc]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type (RGBA)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // IDAT - raw pixel data with filter bytes
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      const di = y * (1 + width * 4) + 1 + x * 4;
      raw[di] = pixels[si];
      raw[di + 1] = pixels[si + 1];
      raw[di + 2] = pixels[si + 2];
      raw[di + 3] = pixels[si + 3];
    }
  }

  const { deflateSync } = require("zlib");
  const compressed = deflateSync(raw);

  // IEND
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", iend),
  ]);
}

// CRC32 lookup table
const crcTable = (function () {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return crc ^ 0xffffffff;
}

// Colors
const BG = [10, 15, 30, 255]; // #0a0f1e
const CYAN = [34, 211, 238]; // #22d3ee

function dist(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function drawWalletIcon(x, y, w, h) {
  const s = w; // size
  const cx = s / 2;
  const cy = s / 2;

  // Background
  const cornerRadius = s * 0.167; // ~32/192
  const dx = Math.min(x, s - 1 - x);
  const dy = Math.min(y, s - 1 - y);
  if (dx < cornerRadius && dy < cornerRadius) {
    if (dist(cornerRadius, cornerRadius, Math.min(x, s - 1 - x) + cornerRadius, Math.min(y, s - 1 - y) + cornerRadius) > cornerRadius) {
      return [0, 0, 0, 0]; // transparent corner
    }
  }

  // Card dimensions (proportional to the SVG)
  const cardLeft = s * 0.1875; // 36/192
  const cardRight = s * 0.8125; // 156/192
  const cardTop = s * 0.2917; // 56/192
  const cardBottom = s * 0.7083; // 136/192
  const cardCorner = s * 0.0625; // 12/192
  const strokeWidth = s * 0.03125; // 6/192
  const lineY = s * 0.4167; // 80/192

  // Card outline
  const inCardX = x >= cardLeft - strokeWidth && x <= cardRight + strokeWidth;
  const inCardY = y >= cardTop - strokeWidth && y <= cardBottom + strokeWidth;

  if (inCardX && inCardY) {
    // Check if on the border
    const innerLeft = cardLeft + strokeWidth;
    const innerRight = cardRight - strokeWidth;
    const innerTop = cardTop + strokeWidth;
    const innerBottom = cardBottom - strokeWidth;

    const onBorder =
      x < innerLeft || x > innerRight || y < innerTop || y > innerBottom;

    // Horizontal line
    const onLine =
      x >= cardLeft && x <= cardRight &&
      Math.abs(y - lineY) < strokeWidth / 2;

    // Circles
    const c1x = s * 0.667; // 128/192
    const c1y = s * 0.5625; // 108/192
    const c2x = s * 0.729; // 140/192
    const c2y = s * 0.5625;
    const cr = s * 0.0625; // 12/192

    const d1 = dist(x, y, c1x, c1y);
    const d2 = dist(x, y, c2x, c2y);
    const inCircle1 = d1 <= cr;
    const inCircle2 = d2 <= cr;

    if (inCircle1 || inCircle2) {
      return [CYAN[0], CYAN[1], CYAN[2], 153]; // 0.6 opacity
    }

    if (onBorder || onLine) {
      return [CYAN[0], CYAN[1], CYAN[2], 255];
    }
  }

  return BG;
}

function drawMaskableIcon(x, y, w, h) {
  // Maskable icons need full bleed — no rounded corners, fill entire square
  const s = w;

  // Card dimensions scaled for maskable safe zone (center 80%)
  const pad = s * 0.1; // extra padding for maskable
  const cardLeft = s * 0.227 + pad * 0.5;
  const cardRight = s * 0.773 - pad * 0.5;
  const cardTop = s * 0.332 + pad * 0.3;
  const cardBottom = s * 0.668 - pad * 0.3;
  const strokeWidth = s * 0.023;
  const lineY = cardTop + (cardBottom - cardTop) * 0.35;

  const inCardX = x >= cardLeft - strokeWidth && x <= cardRight + strokeWidth;
  const inCardY = y >= cardTop - strokeWidth && y <= cardBottom + strokeWidth;

  if (inCardX && inCardY) {
    const innerLeft = cardLeft + strokeWidth;
    const innerRight = cardRight - strokeWidth;
    const innerTop = cardTop + strokeWidth;
    const innerBottom = cardBottom - strokeWidth;
    const onBorder = x < innerLeft || x > innerRight || y < innerTop || y > innerBottom;
    const onLine = x >= cardLeft && x <= cardRight && Math.abs(y - lineY) < strokeWidth / 2;

    const ccx = (cardLeft + cardRight) / 2 + (cardRight - cardLeft) * 0.2;
    const ccy = (lineY + cardBottom) / 2 + (cardBottom - lineY) * 0.1;
    const cr = (cardRight - cardLeft) * 0.06;
    const d1 = dist(x, y, ccx - cr * 0.8, ccy);
    const d2 = dist(x, y, ccx + cr * 0.8, ccy);

    if (d1 <= cr || d2 <= cr) return [CYAN[0], CYAN[1], CYAN[2], 153];
    if (onBorder || onLine) return [CYAN[0], CYAN[1], CYAN[2], 255];
  }

  return BG;
}

// Generate icons
const sizes = [
  { name: "icon-180.png", size: 180, draw: drawWalletIcon },
  { name: "icon-192.png", size: 192, draw: drawWalletIcon },
  { name: "icon-512.png", size: 512, draw: drawWalletIcon },
  { name: "icon-maskable-512.png", size: 512, draw: drawMaskableIcon },
];

for (const { name, size, draw } of sizes) {
  const png = createPNG(size, size, (x, y, w, h) => draw(x, y, w, h));
  const outPath = path.join(ICONS_DIR, name);
  fs.writeFileSync(outPath, png);
  console.log(`Generated ${name} (${size}x${size}) → ${outPath}`);
}

console.log("\nDone! PNG icons generated.");
