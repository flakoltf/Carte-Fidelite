// Construit les assets des 4 cartes de démonstration Wallet (public/demo-cards/).
//
// Ce script est la TRACE REPRODUCTIBLE : les PNG produits sont committés, le
// script permet de les régénérer (photos re-téléchargées, crops et logos refaits).
//
//   node scripts/build-demo-cards.mjs
//
// Photos : Unsplash, licence Unsplash standard (usage commercial autorisé, pas
// d'attribution obligatoire — https://unsplash.com/license). Téléchargées puis
// committées : AUCUN hotlink en production. Les URLs `plus.unsplash.com`
// (Unsplash+, payantes) ont été explicitement écartées lors de la sélection.
//
// Logos : monogrammes SVG dessinés ici, rasterisés dans Chromium (Playwright)
// avec la police Fraunces embarquée en base64 — librsvg/sharp ne charge pas les
// polices web, le navigateur si. Fraunces est celle du repo (next/font).
//
// Sorties par slug (public/demo-cards/<slug>/) :
//   strip.png      1125×369  bannière Apple Wallet (@3x)   [café, boulangerie]
//   hero.png       1032×336  bannière Google Wallet        [café, boulangerie]
//   logo.png       480×150   logo Apple (large, transparent)
//   logo-round.png 660×660   logo Google (plein cadre : Google le recadre en CERCLE)
//   icon.png       87×87     icône de notification Apple (monogramme carré)

import sharp from "sharp";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "demo-cards");

// ─── Photos (Unsplash, licence standard) ─────────────────────────────────────
// Le crop 3:1 est très panoramique : les deux photos ont été choisies (et
// vérifiées visuellement) pour qu'une bande horizontale garde le sujet entier.
const PHOTOS = [
  {
    slug: "cafe-du-marche",
    // « Espresso » — Jordan Merrick — https://unsplash.com/photos/6cY1xBGn9ZI
    url: "https://images.unsplash.com/photo-1510707577719-ae7c14805e3a",
  },
  {
    slug: "boulangerie-perret",
    // « Baguette traditionnelle française » — Franck Tourneret —
    // https://unsplash.com/photos/q-_KXOY9JG8
    url: "https://images.unsplash.com/photo-1705680827676-ea4a49bc6ecb",
  },
];

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function buildPhotoAssets() {
  for (const p of PHOTOS) {
    const dir = path.join(OUT, p.slug);
    await mkdir(dir, { recursive: true });
    // ≥ 1200px de large (on prend 2400 pour garder de la marge au recadrage).
    const original = await fetchBuffer(`${p.url}?w=2400&q=90`);
    // `attention` centre le crop sur la zone saillante (la crema / la croûte) —
    // résultat vérifié visuellement ; les PNG committés restent la référence.
    await sharp(original)
      .resize(1125, 369, { fit: "cover", position: "attention" })
      .png()
      .toFile(path.join(dir, "strip.png"));
    await sharp(original)
      .resize(1032, 336, { fit: "cover", position: "attention" })
      .png()
      .toFile(path.join(dir, "hero.png"));
    console.log(`✓ photos ${p.slug} (strip 1125×369, hero 1032×336)`);
  }
}

// ─── Logos (SVG → PNG via Chromium, Fraunces embarquée) ──────────────────────

// Fraunces regular/semibold/italic depuis Google Fonts (téléchargée au build,
// jamais committée — seule la rasterisation l'est).
const FRAUNCES_CSS =
  "https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,600;1,400&display=swap";

async function frauncesFontFaces() {
  const css = await (
    await fetch(FRAUNCES_CSS, {
      // UA navigateur → Google sert du woff2.
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari/537.36" },
    })
  ).text();
  const faces = [];
  const re = /@font-face\s*{([^}]+)}/g;
  for (const [, body] of css.matchAll(re)) {
    const url = body.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
    if (!url) continue;
    const buf = await fetchBuffer(url);
    faces.push(
      body.replace(
        /url\(https:[^)]+\)\s*format\('woff2'\)/,
        `url(data:font/woff2;base64,${buf.toString("base64")}) format('woff2')`,
      ),
    );
  }
  return faces.map((f) => `@font-face{${f}}`).join("\n");
}

// Monogramme « cœur » de chaque marque, dessiné dans un viewBox 200×200.
// Aucun texte incrusté hors du caractère du monogramme lui-même.
const MONOGRAMS = {
  // Tasse vue de dessus : 3 formes géométriques (cercle crème, anneau latte,
  // point espresso). Pas de glyphe → lisible à toute taille.
  "cafe-du-marche": `
    <circle cx="100" cy="100" r="96" fill="#F5EDE4"/>
    <circle cx="100" cy="100" r="62" fill="none" stroke="#C9A87C" stroke-width="14"/>
    <circle cx="100" cy="100" r="26" fill="#2E211A"/>`,
  // « L » Fraunces italique sur pastille rose poudré.
  "salon-lea": `
    <circle cx="100" cy="100" r="96" fill="#C99BBD"/>
    <text x="104" y="106" text-anchor="middle" dominant-baseline="central"
      font-family="Fraunces" font-style="italic" font-size="118" fill="#2C1B29">L</text>`,
  // Losange farine/croûte avec « P » Fraunces.
  "boulangerie-perret": `
    <rect x="30" y="30" width="140" height="140" transform="rotate(45 100 100)" fill="#4A3413"/>
    <text x="100" y="104" text-anchor="middle" dominant-baseline="central"
      font-family="Fraunces" font-size="96" fill="#F4E7CF">P</text>`,
  // « 7 » Fraunces semi-bold sur carré arrondi menthe glacée.
  "concept-sept": `
    <rect x="4" y="4" width="192" height="192" rx="44" fill="#EDF5F1"/>
    <text x="100" y="106" text-anchor="middle" dominant-baseline="central"
      font-family="Fraunces" font-weight="600" font-size="120" fill="#0C211D">7</text>`,
};

// Fond plein-cadre du logo Google : le cercle inscrit doit rester net une fois
// recadré par Google. On fait « saigner » la couleur de pastille sur tout le
// carré 660×660 et on garde ~15% de marge autour du monogramme.
const GOOGLE_BLEED = {
  "cafe-du-marche": "#F5EDE4",
  "salon-lea": "#C99BBD",
  "boulangerie-perret": "#F4E7CF",
  "concept-sept": "#EDF5F1",
};

function svgDoc(inner, size, { bleed } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 200 200">
    ${bleed ? `<rect width="200" height="200" fill="${bleed}"/>` : ""}
    ${inner}
  </svg>`;
}

async function buildLogos() {
  const fontCss = await frauncesFontFaces();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 800 } });

  for (const [slug, inner] of Object.entries(MONOGRAMS)) {
    const dir = path.join(OUT, slug);
    await mkdir(dir, { recursive: true });

    const shot = async (html, w, h, file, transparent) => {
      await page.setViewportSize({ width: w, height: h });
      await page.setContent(
        `<!doctype html><style>${fontCss}
          html,body{margin:0;padding:0;${transparent ? "background:transparent;" : ""}}</style>
          <body>${html}</body>`,
        { waitUntil: "networkidle" },
      );
      await page.evaluate(() => document.fonts.ready);
      const buf = await page.screenshot({ omitBackground: Boolean(transparent) });
      await writeFile(path.join(dir, file), buf);
    };

    // logo.png 480×150 — asset Apple « large » : monogramme carré calé à gauche,
    // reste transparent (Apple affiche le logo en haut-gauche du pass).
    await shot(
      `<div style="width:480px;height:150px;display:flex;align-items:center;">
         ${svgDoc(inner, 150)}
       </div>`,
      480,
      150,
      "logo.png",
      true,
    );

    // logo-round.png 660×660 — Google recadre en CERCLE : fond plein-cadre +
    // monogramme réduit (~15% de marge → rien d'important ne sort du cercle inscrit).
    await shot(
      `<div style="width:660px;height:660px;background:${GOOGLE_BLEED[slug]};display:flex;align-items:center;justify-content:center;">
         ${svgDoc(inner, 462)}
       </div>`,
      660,
      660,
      "logo-round.png",
      false,
    );

    // icon.png 87×87 — icône de notification Apple (monogramme plein cadre).
    await shot(svgDoc(inner, 87, { bleed: GOOGLE_BLEED[slug] }), 87, 87, "icon.png", false);

    console.log(`✓ logos ${slug} (logo 480×150, logo-round 660×660, icon 87×87)`);
  }

  await browser.close();
}

await buildPhotoAssets();
await buildLogos();
console.log(`\nAssets écrits dans ${OUT}`);
