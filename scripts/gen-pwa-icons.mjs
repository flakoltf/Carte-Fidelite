// Génère les icônes PWA (symbole HALO : anneau émeraude sur fond onyx) via sharp.
// Usage : node scripts/gen-pwa-icons.mjs
import sharp from "sharp";

const svg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#0E0F11"/>
  <circle cx="256" cy="256" r="150" fill="#1FB89A" fill-opacity="0.14"/>
  <circle cx="256" cy="256" r="120" fill="none" stroke="#1FB89A" stroke-width="34"/>
</svg>`;

const buf = Buffer.from(svg);
const out = [
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
  ["public/icons/apple-touch-icon.png", 180],
];

for (const [path, size] of out) {
  await sharp(buf).resize(size, size).png().toFile(path);
  console.log("écrit", path, `${size}x${size}`);
}
