// Generates every logo asset from one vector definition: app icons, splash,
// notification icon, favicons, Play Store graphics, website and README art.
// Needs Google Chrome (headless) for rendering. Run: node scripts/build-brand.mjs
//
// The mark is a bold "F" (Fee) whose third line is a check (paid). On the
// brand tile it is white with a mint check; on light backgrounds it is teal.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME ?? 'google-chrome';
const FONT_DIR = join(ROOT, 'node_modules/@expo-google-fonts/inter');

const C = {
  teal: '#0F766E',
  tealLight: '#14857C',
  tealDark: '#0B5D57',
  mint: '#5EEAD4',
  check: '#14B8A6',
  ink: '#0F172A',
  slate: '#475569',
  white: '#FFFFFF',
};

/** Mark geometry in a 1024 box: stem, two arms, check. Centred by the translate. */
function mark({ bar, check, scale = 1 }) {
  const w = 100;
  const line = (x1, y1, x2, y2, color) =>
    `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
  return `<g transform="translate(512 512) scale(${scale}) translate(-537 -518)">
    ${line(352, 300, 352, 736, bar)}
    ${line(352, 300, 688, 300, bar)}
    ${line(352, 512, 616, 512, bar)}
    <path d="M470 650L556 736L722 570" stroke="${check}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </g>`;
}

const gradient = (id) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.tealLight}"/><stop offset="1" stop-color="${C.tealDark}"/></linearGradient>`;

const fonts = `@font-face{font-family:Inter;font-weight:800;src:url("file://${FONT_DIR}/800ExtraBold/Inter_800ExtraBold.ttf")}
@font-face{font-family:Inter;font-weight:600;src:url("file://${FONT_DIR}/600SemiBold/Inter_600SemiBold.ttf")}`;

const svg = (w, h, body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><style>${fonts}</style>${defs}</defs>${body}</svg>`;

/** Tile: full-bleed gradient square (optionally rounded) with the mark. */
const tile = (size, radius, scale) =>
  svg(
    size,
    size,
    `<rect width="1024" height="1024" rx="${radius}" fill="url(#g)"/>${mark({ bar: C.white, check: C.mint, scale })}`.replace(
      /^<rect/,
      `<g transform="scale(${size / 1024})"><rect`,
    ) + '</g>',
    gradient('g'),
  );

const onTransparent = (size, colors, scale) =>
  svg(size, size, `<g transform="scale(${size / 1024})">${mark({ ...colors, scale })}</g>`);

function wordmark({ x, y, size, color, sub, subColor, subSize }) {
  return `<text x="${x}" y="${y}" font-family="Inter" font-weight="800" font-size="${size}" letter-spacing="${-size * 0.03}" fill="${color}">Fee Tracker</text>
  ${sub ? `<text x="${x}" y="${y + subSize * 1.45}" font-family="Inter" font-weight="600" font-size="${subSize}" letter-spacing="${subSize * 0.02}" fill="${subColor}">${sub}</text>` : ''}`;
}

/** Horizontal lockup on a light background: tile + wordmark + tagline. */
const lockupLight = (f = 1) =>
  svg(
    1600 * f,
    480 * f,
    `<g transform="scale(${f})"><g transform="translate(60 60) scale(${360 / 1024})"><rect width="1024" height="1024" rx="224" fill="url(#g)"/>${mark({ bar: C.white, check: C.mint, scale: 0.9 })}</g>
    ${wordmark({ x: 490, y: 268, size: 150, color: C.ink, sub: 'Collection Book', subColor: C.slate, subSize: 54 })}</g>`,
    gradient('g'),
  );

const featureGraphic = (f = 1) =>
  svg(
    1024 * f,
    500 * f,
    `<g transform="scale(${f})"><rect width="1024" height="500" fill="url(#g)"/>
    <circle cx="930" cy="-40" r="260" fill="${C.white}" fill-opacity="0.05"/>
    <circle cx="120" cy="560" r="220" fill="${C.white}" fill-opacity="0.05"/>
    <g transform="translate(70 70) scale(${360 / 1024})">${mark({ bar: C.white, check: C.mint, scale: 1 })}</g>
    ${wordmark({ x: 420, y: 256, size: 100, color: C.white, sub: 'Monthly fees, paid or unpaid, at a glance.', subColor: C.mint, subSize: 27 })}</g>`,
    gradient('g'),
  );

const OUT = [
  // App icons (Expo / Android adaptive). `make(s)` draws the asset at s px.
  { file: 'assets/icon.png', size: [1024, 1024], make: (s) => tile(s, 0, 0.9), alpha: false },
  { file: 'assets/android-icon-background.png', size: [1024, 1024], make: (s) => svg(s, s, `<rect width="${s}" height="${s}" fill="url(#g)"/>`, gradient('g')), alpha: false },
  { file: 'assets/android-icon-foreground.png', size: [1024, 1024], make: (s) => onTransparent(s, { bar: C.white, check: C.mint }, 0.86), alpha: true },
  { file: 'assets/android-icon-monochrome.png', size: [1024, 1024], make: (s) => onTransparent(s, { bar: C.white, check: C.white }, 0.86), alpha: true },
  { file: 'assets/splash-icon.png', size: [1024, 1024], make: (s) => onTransparent(s, { bar: C.white, check: C.mint }, 0.9), alpha: true },
  { file: 'assets/notification-icon.png', size: [96, 96], make: (s) => onTransparent(s, { bar: C.white, check: C.white }, 0.95), alpha: true },
  { file: 'assets/favicon.png', size: [48, 48], make: (s) => tile(s, 200, 0.9), alpha: true },
  // In-app images
  { file: 'assets/brand/mark-white.png', size: [256, 256], make: (s) => onTransparent(s, { bar: C.white, check: C.mint }, 1), alpha: true },
  { file: 'assets/brand/mark.png', size: [256, 256], make: (s) => onTransparent(s, { bar: C.teal, check: C.check }, 1), alpha: true },
  { file: 'assets/brand/logo-lockup.png', size: [1600, 480], make: (s) => lockupLight(s / 1600), alpha: true },
  // Store graphics
  { file: 'docs/store/play-icon-512.png', size: [512, 512], make: (s) => tile(s, 0, 0.9), alpha: true },
  { file: 'docs/store/feature-graphic-1024x500.png', size: [1024, 500], make: (s) => featureGraphic(s / 1024), alpha: false },
  // Website
  { file: 'docs/favicon.png', size: [64, 64], make: (s) => tile(s, 200, 0.9), alpha: true },
];

const SVGS = {
  'assets/brand/mark.svg': onTransparent(512, { bar: C.teal, check: C.check }, 1),
  'assets/brand/mark-white.svg': onTransparent(512, { bar: C.white, check: C.mint }, 1),
  'assets/brand/logo.svg': lockupLight(),
  'docs/logo.svg': lockupLight(),
};

const work = mkdtempSync(join(tmpdir(), 'brand-'));
try {
  for (const [file, body] of Object.entries(SVGS)) {
    mkdirSync(dirname(join(ROOT, file)), { recursive: true });
    // Standalone SVGs must not point at local font files.
    writeFileSync(join(ROOT, file), body.replace(/<style>[\s\S]*?<\/style>/, '<style>text{font-family:Inter,system-ui,sans-serif}</style>'));
    console.log(file);
  }
  for (const { file, size, make, alpha } of OUT) {
    // Chrome won't lay out a tiny window, and small icons look better
    // supersampled anyway: draw at >= 512 px and scale down afterwards.
    const factor = Math.max(1, Math.ceil(512 / Math.min(...size)));
    const renderSize = size.map((n) => n * factor);
    const src = join(work, file.replace(/[\\/]/g, '_') + '.svg');
    writeFileSync(src, make(renderSize[0]));
    const out = join(ROOT, file);
    mkdirSync(dirname(out), { recursive: true });
    const raw = factor === 1 && !alpha ? out : join(work, 'raw.png');
    execFileSync(
      CHROME,
      [
        '--headless=new',
        '--no-sandbox',
        '--disable-gpu',
        '--hide-scrollbars',
        '--force-device-scale-factor=1',
        `--user-data-dir=${join(work, 'profile')}`,
        `--window-size=${renderSize[0]},${renderSize[1]}`,
        ...(alpha ? ['--default-background-color=00000000'] : []),
        `--screenshot=${raw}`,
        `file://${src}`,
      ],
      { stdio: 'ignore', timeout: 60000 },
    );
    if (raw !== out) {
      // Downscale with a good filter and keep an alpha channel where asked.
      execFileSync('python3', [
        '-c',
        `from PIL import Image; im=Image.open(${JSON.stringify(raw)}); im=im.convert('RGBA' if ${alpha ? 'True' : 'False'} else 'RGB'); im=im.resize((${size[0]}, ${size[1]}), Image.LANCZOS) if im.size!=(${size[0]}, ${size[1]}) else im; im.save(${JSON.stringify(out)}, optimize=True)`,
      ]);
    }
    console.log(file);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
