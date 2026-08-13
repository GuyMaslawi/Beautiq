/**
 * מחולל נכסי המותג של Allura (אייקון האפליקציה + favicon).
 *
 * הגאומטריה של האות A מוגדרת כאן פעם אחת, וכל שאר הקבצים נגזרים ממנה,
 * כדי שלא ייווצר מצב שבו אייקון אחד מתעדכן והשאר נשארים מאחור.
 *
 * הרצה:  npm run brand:icons
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

// הסקריפט מורץ דרך npm run מתיקיית השורש של הפרויקט.
const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, "src", "app");
const BRANDING_DIR = path.join(ROOT, "public", "branding");

const SIZE = 1024;
const CORNER_RADIUS = 232;

// צבעי המותג — זהים לטוקנים ב-globals.css (--brand-gradient, --accent).
const GRADIENT_FROM = "#c76f93";
const GRADIENT_MID = "#ac5c7f";
const GRADIENT_TO = "#92609f";

/**
 * האות A: שתי רגליים עם שוליים חיצוניים קעורים שנפתחים לכפות מעוגלות,
 * ועליהן פס אופקי. שתי הרגליים חולקות את אותה נקודת שיא כדי שהחוד ייקרא
 * כקצה אחד ולא כשקע. הצורות מלאות (ולא קווי מתאר) כדי שהסימן יישאר חד
 * מ-1024px ועד 16px.
 */
const GLYPH = `
    <g fill="#ffffff" stroke="#ffffff" stroke-width="26" stroke-linejoin="round" stroke-linecap="round">
      <path d="M 512 238 C 468 392, 386 622, 244 786 L 346 786 C 428 622, 492 404, 512 306 Z"/>
      <path d="M 512 238 C 556 392, 638 622, 780 786 L 678 786 C 596 622, 532 404, 512 306 Z"/>
      <rect x="384" y="600" width="256" height="54" rx="27"/>
    </g>`;

type IconOptions = {
  /** פינות מעוגלות + מסגרת פנימית עדינה. כבוי = ריבוע מלא לקצוות. */
  rounded: boolean;
  /** הגדלת האות ביחס למרכז. גדלים קטנים צריכים אות מלאה יותר. */
  glyphScale?: number;
};

function buildSvg({ rounded, glyphScale = 1 }: IconOptions): string {
  const clip = rounded
    ? `
    <clipPath id="squircle">
      <rect x="0" y="0" width="${SIZE}" height="${SIZE}" rx="${CORNER_RADIUS}" ry="${CORNER_RADIUS}"/>
    </clipPath>`
    : "";
  const clipAttr = rounded ? ` clip-path="url(#squircle)"` : "";
  // מסגרת פנימית דקה שנותנת לאייקון קצה "מואר" ומרגיש איכותי.
  const rim = rounded
    ? `
  <rect x="4" y="4" width="${SIZE - 8}" height="${SIZE - 8}" rx="${CORNER_RADIUS - 2}" ry="${CORNER_RADIUS - 2}"
        fill="none" stroke="#ffffff" stroke-opacity="0.16" stroke-width="8"/>`
    : "";
  const center = SIZE / 2;
  const glyph =
    glyphScale === 1
      ? GLYPH
      : `<g transform="translate(${center} ${center}) scale(${glyphScale}) translate(${-center} ${-center})">${GLYPH}
    </g>`;

  return `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${SIZE}" y2="${SIZE}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${GRADIENT_FROM}"/>
      <stop offset="0.5" stop-color="${GRADIENT_MID}"/>
      <stop offset="1" stop-color="${GRADIENT_TO}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.14" r="0.9">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.24"/>
      <stop offset="0.62" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>${clip}
  </defs>

  <g${clipAttr}>
    <rect x="0" y="0" width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>
    <rect x="0" y="0" width="${SIZE}" height="${SIZE}" fill="url(#glow)"/>
${glyph}
  </g>${rim}
</svg>
`;
}

function render(svg: string, px: number): Promise<Buffer> {
  // density גבוה כדי שהרסטר ייגזר מווקטור בדיוק מלא ולא מתמונה מוקטנת.
  return sharp(Buffer.from(svg), { density: 600 })
    .resize(px, px, { fit: "fill" })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * בונה קובץ .ico מרובה-גדלים שבו כל תמונה מקוננת כ-PNG. הפורמט נתמך
 * בכל הדפדפנים המודרניים ושומר על שקיפות בפינות המעוגלות.
 */
function buildIco(images: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  const directory = Buffer.alloc(16 * images.length);
  let offset = header.length + directory.length;

  images.forEach((image, index) => {
    const at = index * 16;
    // 0 מסמן 256 בפורמט ICO.
    directory.writeUInt8(image.size >= 256 ? 0 : image.size, at);
    directory.writeUInt8(image.size >= 256 ? 0 : image.size, at + 1);
    directory.writeUInt8(0, at + 2); // color palette
    directory.writeUInt8(0, at + 3); // reserved
    directory.writeUInt16LE(1, at + 4); // color planes
    directory.writeUInt16LE(32, at + 6); // bits per pixel
    directory.writeUInt32LE(image.data.length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += image.data.length;
  });

  return Buffer.concat([
    header,
    directory,
    ...images.map((image) => image.data),
  ]);
}

async function main() {
  mkdirSync(BRANDING_DIR, { recursive: true });

  // גרסת הטאב: אות גדולה יותר, כי ב-16px כל פיקסל נחשב.
  const faviconSvg = buildSvg({ rounded: true, glyphScale: 1.12 });
  // גרסת אייקון האפליקציה: פרופורציה רגילה, פינות מעוגלות.
  const appSvg = buildSvg({ rounded: true });
  // גרסה לקצוות: לאייקון של iOS ולתמונות פרופיל (WhatsApp/Meta), שבהן
  // הפלטפורמה מחילה מיסוך משלה — פינות מעוגלות כאן היו נחתכות פעמיים.
  const fullBleedSvg = buildSvg({ rounded: false });

  writeFileSync(path.join(APP_DIR, "icon.svg"), faviconSvg);
  writeFileSync(path.join(BRANDING_DIR, "allura-icon.svg"), appSvg);

  const ico = buildIco(
    await Promise.all(
      [16, 32, 48].map(async (size) => ({
        size,
        data: await render(faviconSvg, size),
      })),
    ),
  );
  writeFileSync(path.join(APP_DIR, "favicon.ico"), ico);

  writeFileSync(
    path.join(APP_DIR, "apple-icon.png"),
    await render(fullBleedSvg, 180),
  );

  writeFileSync(
    path.join(BRANDING_DIR, "allura-favicon-16.png"),
    await render(faviconSvg, 16),
  );
  writeFileSync(
    path.join(BRANDING_DIR, "allura-favicon-32.png"),
    await render(faviconSvg, 32),
  );
  writeFileSync(
    path.join(BRANDING_DIR, "allura-app-icon-512.png"),
    await render(fullBleedSvg, 512),
  );
  writeFileSync(
    path.join(BRANDING_DIR, "allura-app-icon-1024.png"),
    await render(fullBleedSvg, 1024),
  );
  // גרסה מעוגלת ושקופה לשימוש על גבי רקעים בהירים (מצגות, אתר, מסמכים).
  writeFileSync(
    path.join(BRANDING_DIR, "allura-app-icon-rounded-512.png"),
    await render(appSvg, 512),
  );

  console.log("Brand icons generated.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
