// Gera os ícones do PWA a partir de um SVG (node scripts/generate-icons.mjs)
import sharp from "sharp";
import { mkdirSync } from "node:fs";

mkdirSync("public/icons", { recursive: true });

// Mãos + coração simplificados sobre fundo da marca
const glyph = (size, pad) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0f766e"/>
  <g transform="translate(${256 - 256 * pad} ${256 - 256 * pad}) scale(${pad})" fill="none" stroke="#fff" stroke-width="30" stroke-linecap="round" stroke-linejoin="round">
    <path d="M256 330c-60-44-96-76-96-120a52 52 0 0 1 96-28 52 52 0 0 1 96 28c0 44-36 76-96 120z" fill="#fff" stroke="none"/>
    <path d="M84 318 Q256 470 428 318" />
    <path d="M130 372 Q256 470 382 372" stroke-width="22"/>
  </g>
</svg>`;

const jobs = [
  ["icon-192.png", 192, 0.82],
  ["icon-512.png", 512, 0.82],
  ["icon-maskable-512.png", 512, 0.6], // área segura maior para máscaras
  ["badge-72.png", 72, 0.8],
];
for (const [name, size, pad] of jobs) {
  await sharp(Buffer.from(glyph(size, pad))).png().toFile(`public/icons/${name}`);
  console.log("ok", name);
}
