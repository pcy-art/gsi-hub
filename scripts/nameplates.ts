// Generates the report nameplates (site/brand/nameplates/*.svg and index.json): the subject word
// from site/site.ts and the Korean title, set solid in Noto Sans KR Bold (SIL OFL 1.1) as SVG paths,
// so the nameplate is one static logotype on every system.
//
// Usage: node scripts/nameplates.ts [font path or noto-sans-sc package dir]
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SITE } from "../site/site.ts";

let opentype: any;
try {
  opentype = (await import("@shuding/opentype.js")).default ?? (await import("@shuding/opentype.js"));
} catch {
  opentype = (await import("opentype.js")).default ?? (await import("opentype.js"));
}

const fontArg = process.argv[2] || "assets/og-fonts/noto-sans-kr-700.otf";

/** Ink height of the glyphs, in the nameplate's units. */
const H = 220;
/** Latin capitals a touch shorter than the ideographs, which read larger. */
const CAPS = H * 0.94;
const MARGIN = 12;
const isLatin = (ch: string) => /[A-Za-z]/.test(ch);

/** Space between the inks of two neighbours. */
function gap(a: string, b: string): number {
  if (isLatin(a) && isLatin(b)) return H * 0.07;
  if (isLatin(a) !== isLatin(b)) return H * 0.17;
  return H * 0.085;
}

const NAMEPLATES: Record<string, Array<{ text: string; accent: boolean }>> = {
  daily: [
    { text: "일일", accent: true },
    { text: "상황보고", accent: false },
  ],
  weekly: [
    { text: "주간", accent: true },
    { text: "정세평가", accent: false },
  ],
  monthly: [
    { text: "월간", accent: true },
    { text: "전략평가", accent: false },
  ],
  archive: [
    { text: "상황보고", accent: false },
    { text: "보관함", accent: true },
  ],
};

function getBounds(p: any) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const cmd of p.commands) {
    for (const k of ["x", "x1", "x2"]) {
      if (cmd[k] !== undefined) {
        x1 = Math.min(x1, cmd[k]);
        x2 = Math.max(x2, cmd[k]);
      }
    }
    for (const k of ["y", "y1", "y2"]) {
      if (cmd[k] !== undefined) {
        y1 = Math.min(y1, cmd[k]);
        y2 = Math.max(y2, cmd[k]);
      }
    }
  }
  return { x1, y1, x2, y2 };
}

let fontFor: (ch: string) => any;

if (existsSync(fontArg) && statSync(fontArg).isFile()) {
  const buf = readFileSync(fontArg);
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  fontFor = () => font;
} else if (existsSync(fontArg) && statSync(fontArg).isDirectory()) {
  const css = readFileSync(path.join(fontArg, "900.css"), "utf8");
  const faces = [...css.matchAll(/url\(\.\/files\/([\w-]+)\.woff2\)[^;]*;\s*unicode-range: ([^;]+);/g)].map((m) => ({
    file: `${m[1]}.woff`,
    ranges: m[2]!.split(",").map((r) => r.trim().replace("U+", "").split("-").map((h) => parseInt(h, 16))),
  }));
  const fonts = new Map<string, any>();
  fontFor = (ch: string) => {
    const cp = ch.codePointAt(0)!;
    const face = faces.find((f) => f.ranges.some(([a, b]) => cp >= a! && cp <= (b ?? a!)));
    if (!face) throw new Error(`no slice holds ${ch}`);
    if (!fonts.has(face.file)) {
      const buf = readFileSync(path.join(fontArg, "files", face.file));
      fonts.set(face.file, opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)));
    }
    return fonts.get(face.file)!;
  };
} else {
  throw new Error(`Font file or directory not found: ${fontArg}`);
}

const chars = [...new Set(Object.values(NAMEPLATES).flatMap((parts) => parts.flatMap((p) => [...p.text])))];
const boxes = new Map(chars.map((ch) => [ch, getBounds(fontFor(ch).getPath(ch, 0, 0, 1000))]));

function fit(group: string[], height: number) {
  const top = Math.min(...group.map((ch) => boxes.get(ch)!.y1));
  const bottom = Math.max(...group.map((ch) => boxes.get(ch)!.y2));
  const size = (1000 * height) / (bottom - top);
  return { size, baseline: -((top + bottom) / 2) * (size / 1000) };
}

const hangul = fit(chars.filter((ch) => !isLatin(ch)), H);
const latin = chars.some(isLatin) ? fit(chars.filter(isLatin), CAPS) : hangul;

const out: Record<string, { viewBox: string; accent: string; ink: string }> = {};
for (const [name, parts] of Object.entries(NAMEPLATES)) {
  const accent: string[] = [];
  const ink: string[] = [];
  let x = MARGIN;
  let prev: string | null = null;
  for (let pIdx = 0; pIdx < parts.length; pIdx++) {
    const part = parts[pIdx];
    if (pIdx > 0 && prev) {
      x += H * 0.20;
      prev = null;
    }
    for (const ch of part.text) {
      const { size, baseline } = isLatin(ch) ? latin : hangul;
      const box = boxes.get(ch)!;
      const scale = size / 1000;
      if (prev) x += gap(prev, ch);
      const origin = x - box.x1 * scale;
      (part.accent ? accent : ink).push(fontFor(ch).getPath(ch, origin, baseline, size).toPathData(1));
      x = origin + box.x2 * scale;
      prev = ch;
    }
  }
  const half = Math.max(H, CAPS) / 2 + MARGIN;
  out[name] = {
    viewBox: `0 ${(-half).toFixed(1)} ${(x + MARGIN).toFixed(1)} ${(2 * half).toFixed(1)}`,
    accent: accent.join(" "),
    ink: ink.join(" "),
  };
}

const target = "site/brand/nameplates";
mkdirSync(target, { recursive: true });
for (const [name, n] of Object.entries(out)) {
  writeFileSync(
    `${target}/${name}.svg`,
    `<!-- Generated by scripts/nameplates.ts. Noto Sans KR Bold (SIL OFL 1.1). -->\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n.viewBox}"><path id="accent" d="${n.accent}"/><path id="ink" d="${n.ink}"/></svg>\n`
  );
}
writeFileSync(
  `${target}/index.json`,
  `${JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.viewBox])), null, 2)}\n`
);

console.log(
  target,
  Object.fromEntries(
    Object.entries(out).map(([k, v]) => [
      k,
      `${v.viewBox} · ${((v.accent.length + v.ink.length) / 1000).toFixed(1)} kB`,
    ])
  )
);
