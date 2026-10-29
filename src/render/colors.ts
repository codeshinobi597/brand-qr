import { QRCodeError } from '../errors';

const HEX_RE = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNCTIONAL_RE = /^(?:rgb|rgba|hsl|hsla)\(\s*[0-9.,%\s/+-]+(?:deg|turn|rad)?[0-9.,%\s/+-]*\)$/i;
const NAMED_RE = /^[a-z]+$/i;

/** Accepts hex, rgb[a](), hsl[a](), and CSS keywords (named colors, `transparent`, `currentColor`). */
export function assertColor(name: string, value: string): void {
  const v = value.trim();
  if (HEX_RE.test(v) || FUNCTIONAL_RE.test(v) || NAMED_RE.test(v)) return;
  throw new QRCodeError('INVALID_COLOR', `${name} is not a valid CSS color: ${JSON.stringify(value)}`);
}

type RGB = readonly [number, number, number];

const KNOWN_NAMES: Record<string, RGB> = {
  black: [0, 0, 0],
  white: [255, 255, 255],
};

/** Best-effort parse to RGB for contrast checks; returns `null` for colors we can't resolve statically. */
export function parseRGB(value: string): RGB | null {
  const v = value.trim().toLowerCase();
  const named = KNOWN_NAMES[v];
  if (named) return named;

  if (HEX_RE.test(v)) {
    let hex = v.slice(1);
    if (hex.length <= 4) hex = [...hex].map((c) => c + c).join('');
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  }

  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(v);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];

  return null;
}

function luminance([r, g, b]: RGB): number {
  const channel = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio, or `null` if either color can't be resolved. */
export function contrastRatio(a: string, b: string): number | null {
  const ra = parseRGB(a);
  const rb = parseRGB(b);
  if (!ra || !rb) return null;
  const la = luminance(ra);
  const lb = luminance(rb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function isDarker(a: string, b: string): boolean | null {
  const ra = parseRGB(a);
  const rb = parseRGB(b);
  if (!ra || !rb) return null;
  return luminance(ra) < luminance(rb);
}
