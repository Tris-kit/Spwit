// One-off: turn spwit_logo_orange.png into all app/web/PWA assets.
// Keys out the near-white background → transparent, trims margins, then emits a
// transparent logo (in-app + favicon) and opaque brand-bg icons (iOS/PWA).
const sharp = require("sharp");
const path = require("path");

const ROOT = path.join(__dirname, "..", ".."); // repo root
const SRC = path.join(ROOT, "spwit_logo_orange.png");
const MOBILE = path.join(ROOT, "mobile", "assets");
const PWA = path.join(__dirname, "..", "pwa");
const BG = { r: 255, g: 249, b: 244, alpha: 1 }; // #FFF9F4 brand canvas

async function keyedTrimmed() {
  const { data, info } = await sharp(SRC)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    // neutral (low saturation) AND bright → it's the background: make transparent
    if (mn >= 232 && mx - mn <= 14) data[i + 3] = 0;
  }
  const buf = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
  // trim the now-transparent border so the art fills the frame
  return sharp(buf).trim().png().toBuffer();
}

async function transparentLogo(logo, size, padFrac) {
  const inner = Math.round(size * (1 - 2 * padFrac));
  const art = await sharp(logo)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: art, gravity: "center" }])
    .png()
    .toBuffer();
}

async function opaqueIcon(logo, size, padFrac) {
  const inner = Math.round(size * (1 - 2 * padFrac));
  const art = await sharp(logo)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: art, gravity: "center" }])
    .flatten({ background: BG })
    .removeAlpha() // iOS app icons must not carry an alpha channel
    .png()
    .toBuffer();
}

(async () => {
  const logo = await keyedTrimmed();
  const write = (buf, p) => sharp(buf).toFile(p).then(() => console.log("wrote", p.replace(ROOT, "")));

  // Transparent art (blends on any bg)
  write(await transparentLogo(logo, 512, 0.06), path.join(MOBILE, "logo.png"));
  write(await transparentLogo(logo, 128, 0.04), path.join(PWA, "logo.png")); // share-page header
  write(await transparentLogo(logo, 96, 0.06), path.join(MOBILE, "favicon.png"));
  write(await transparentLogo(logo, 1024, 0.24), path.join(MOBILE, "splash-icon.png"));
  // Android adaptive foreground is transparent; system paints the bg color.
  write(await transparentLogo(logo, 1024, 0.28), path.join(MOBILE, "android-icon-foreground.png"));

  // Opaque icons on the brand canvas (iOS requires no alpha)
  write(await opaqueIcon(logo, 1024, 0.18), path.join(MOBILE, "icon.png"));
  write(await opaqueIcon(logo, 512, 0.16), path.join(PWA, "icon-512.png"));
  write(await opaqueIcon(logo, 192, 0.16), path.join(PWA, "icon-192.png"));
  write(await opaqueIcon(logo, 180, 0.12), path.join(PWA, "apple-touch-icon.png"));
})();
