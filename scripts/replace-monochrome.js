/**
 * replace-monochrome.js
 * Replaces ic_launcher_monochrome.webp in all mipmap folders
 * using the white monochrome version of the Gastos logo.
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Use the white monochrome SVG for the monochrome adaptive icon
const SOURCE = path.resolve('E:/My-APp/Gastos-logo (1)/vector/isolated-monochrome-white.svg');
const RES   = path.resolve(__dirname, '../android/app/src/main/res');

const MIPMAP_SIZES = [
  { dir: 'mipmap-mdpi',    size: 48  },
  { dir: 'mipmap-hdpi',    size: 72  },
  { dir: 'mipmap-xhdpi',   size: 96  },
  { dir: 'mipmap-xxhdpi',  size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

async function main() {
  console.log('Source:', SOURCE);
  if (!fs.existsSync(SOURCE)) {
    console.error('ERROR: Source file not found:', SOURCE);
    process.exit(1);
  }

  for (const { dir, size } of MIPMAP_SIZES) {
    const dirPath = path.join(RES, dir);
    const dest = path.join(dirPath, 'ic_launcher_monochrome.webp');
    await sharp(SOURCE)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ lossless: true })
      .toFile(dest);
    console.log(`✓ Wrote ${dest} (${size}x${size})`);
  }

  console.log('\n✅ Monochrome icons replaced!');
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
