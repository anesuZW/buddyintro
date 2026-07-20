#!/usr/bin/env node
/**
 * Generate PWA PNG icons from SVG source using sharp.
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const ICONS = path.join(ROOT, "public", "icons");
const SOURCE = path.join(ICONS, "icon-512.svg");

const SIZES = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-256.png", size: 256 },
  { name: "icon-384.png", size: 384 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "favicon-32.png", size: 32 },
  { name: "favicon-16.png", size: 16 },
  { name: "maskable-icon-512.png", size: 512, maskable: true },
];

async function renderMaskable(size) {
  const padding = Math.round(size * 0.1);
  const inner = size - padding * 2;
  const svg = fs.readFileSync(SOURCE);
  const icon = await sharp(svg).resize(inner, inner).png().toBuffer();
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 },
    },
  })
    .composite([{ input: icon, top: padding, left: padding }])
    .png()
    .toBuffer();
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error("Missing source SVG:", SOURCE);
    process.exit(1);
  }

  fs.mkdirSync(ICONS, { recursive: true });

  for (const spec of SIZES) {
    const out = path.join(ICONS, spec.name);
    if (spec.maskable) {
      await fs.promises.writeFile(out, await renderMaskable(spec.size));
    } else {
      await sharp(SOURCE).resize(spec.size, spec.size).png().toFile(out);
    }
    console.log(`✓ ${spec.name}`);
  }

  const favicon32 = path.join(ICONS, "favicon-32.png");
  const faviconIco = path.join(ROOT, "public", "favicon.ico");
  await fs.promises.copyFile(favicon32, faviconIco);
  await fs.promises.copyFile(favicon32, path.join(ROOT, "public", "favicon.png"));
  console.log("✓ favicon.ico");

  const pinned = path.join(ICONS, "safari-pinned-tab.svg");
  if (!fs.existsSync(pinned)) {
    const pinnedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#2563EB"/><text x="256" y="300" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif" font-size="180" font-weight="800">FI</text></svg>`;
    await fs.promises.writeFile(pinned, pinnedSvg);
    console.log("✓ safari-pinned-tab.svg");
  }

  console.log("✓ PWA icons generated");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
