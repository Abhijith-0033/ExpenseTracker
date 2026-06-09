/**
 * replace-logos.js
 * Resizes the Gastos logo PNG into all required Android density sizes
 * for both splash screen drawables and mipmap launcher icons.
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SOURCE = path.resolve('E:/My-APp/Gastos-logo (1)/profile.png');
const RES   = path.resolve(__dirname, '../android/app/src/main/res');

// Splash screen sizes (imageWidth: 200 in app.json → base mdpi = 200px)
// Android density multipliers: mdpi=1x, hdpi=1.5x, xhdpi=2x, xxhdpi=3x, xxxhdpi=4x
const SPLASH_SIZES = [
  { dir: 'drawable-mdpi',    size: 200 },
  { dir: 'drawable-hdpi',    size: 300 },
  { dir: 'drawable-xhdpi',   size: 400 },
  { dir: 'drawable-xxhdpi',  size: 600 },
  { dir: 'drawable-xxxhdpi', size: 800 },
];

// Launcher icon sizes (mipmap)
const MIPMAP_SIZES = [
  { dir: 'mipmap-mdpi',    size: 48  },
  { dir: 'mipmap-hdpi',    size: 72  },
  { dir: 'mipmap-xhdpi',   size: 96  },
  { dir: 'mipmap-xxhdpi',  size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

async function resizeAndSave(srcPath, destPath, size) {
  await sharp(srcPath)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(destPath);
  console.log(`✓ Wrote ${destPath} (${size}x${size})`);
}

async function main() {
  console.log('Source:', SOURCE);
  if (!fs.existsSync(SOURCE)) {
    console.error('ERROR: Source file not found:', SOURCE);
    process.exit(1);
  }

  // Replace splash screen pngs
  for (const { dir, size } of SPLASH_SIZES) {
    const dest = path.join(RES, dir, 'splashscreen_logo.png');
    const dirPath = path.join(RES, dir);
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
    await resizeAndSave(SOURCE, dest, size);
  }

  // Replace mipmap launcher icon pngs (as png first, webp conversion via sharp)
  for (const { dir, size } of MIPMAP_SIZES) {
    const dirPath = path.join(RES, dir);
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });

    // Write launcher icon as webp (ic_launcher.webp and ic_launcher_round.webp)
    

    const icLauncher       = path.join(dirPath, 'ic_launcher.webp');
    const icLauncherRound  = path.join(dirPath, 'ic_launcher_round.webp');
    const icForeground     = path.join(dirPath, 'ic_launcher_foreground.webp');

    await sharp(SOURCE).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ lossless: true }).toFile(icLauncher);
    console.log(`✓ Wrote ${icLauncher}`);

    await sharp(SOURCE).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ lossless: true }).toFile(icLauncherRound);
    console.log(`✓ Wrote ${icLauncherRound}`);

    // Foreground is typically larger (108dp safe zone)
    const fgSize = Math.round(size * 1.5);
    await sharp(SOURCE).resize(fgSize, fgSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ lossless: true }).toFile(icForeground);
    console.log(`✓ Wrote ${icForeground}`);
  }

  console.log('\n✅ All logo assets replaced successfully!');
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
