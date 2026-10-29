import type { FontWeight } from '../types';
import type { ResolvedLabel, ResolvedOptions } from './options';

/** Half-open rectangle in module coordinates: x0 <= x < x1, y0 <= y < y1. */
export interface ModuleBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface LabelLayout {
  text: string;
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  fontSize: number;
  fontFamily: string;
  fontWeight: FontWeight;
  color: string;
  /**
   * Exact rendered text width. Set for labels drawn over the code, so the text can't come out
   * wider than estimated, and for outside labels that would overflow and must be compressed.
   */
  textLength: number | undefined;
  badge: { x: number; y: number; width: number; height: number; rx: number; fill: string } | null;
  /** Area the text is clipped to. Set for labels drawn over the code. */
  clip: Rect | null;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Layout {
  width: number;
  height: number;
  /** Size of one module in px. */
  unit: number;
  /** Position of module (0, 0) in px. */
  qrX: number;
  qrY: number;
  /** Modules hidden behind a center or inside-corner label. */
  excavation: ModuleBox | null;
  label: LabelLayout | null;
}

// Share of the symbol a center badge may cover. Level H restores up to ~30% of codewords;
// staying well under that leaves headroom for print defects and camera blur.
const CENTER_MAX_WIDTH = 0.6;
const CENTER_MAX_HEIGHT = 0.25;
const CENTER_MAX_AREA = 0.12;

// Inside-corner label limits. Four rows keeps the box below the bottom-right alignment pattern
// (rows size-9..size-5); the width cap keeps it clear of the bottom-left finder and format bits.
const INSIDE_MAX_ROWS = 4;
const INSIDE_MAX_WIDTH = 0.45;

/** Smallest default corner font size in px; below this text is unreadable on small codes. */
const MIN_CORNER_FONT_SIZE = 8;

/** Average advance width per character relative to font size. No DOM is available for measuring. */
function estimateTextWidth(text: string, fontSize: number, weight: FontWeight): number {
  const bold = weight === 'bold' || (typeof weight === 'number' && weight >= 600);
  return [...text].length * fontSize * (bold ? 0.62 : 0.56);
}

export function computeLayout(moduleCount: number, options: ResolvedOptions): Layout {
  const { size, margin, label } = options;
  const unit = size / (moduleCount + margin * 2);
  const base: Layout = {
    width: size,
    height: size,
    unit,
    qrX: margin * unit,
    qrY: margin * unit,
    excavation: null,
    label: null,
  };
  if (!label) return base;
  if (label.position === 'center') return layoutCenter(base, moduleCount, label);
  if (label.placement === 'inside') return layoutInsideCorner(base, moduleCount, label);
  return layoutCorner(base, label);
}

function layoutCorner(base: Layout, label: ResolvedLabel): Layout {
  const fontSize = label.fontSize ?? Math.max(MIN_CORNER_FONT_SIZE, base.width * 0.06);
  const padding = label.padding ?? fontSize * 0.4;
  const bandHeight = fontSize + padding * 2;
  const isTop = label.position === 'top-left' || label.position === 'top-right';
  const isLeft = label.position === 'top-left' || label.position === 'bottom-left';

  const inset = Math.max(base.qrX, padding);
  const available = base.width - inset * 2;
  const textWidth = estimateTextWidth(label.text, fontSize, label.fontWeight);

  return {
    ...base,
    height: base.height + bandHeight,
    qrY: base.qrY + (isTop ? bandHeight : 0),
    label: {
      text: label.text,
      x: isLeft ? inset : base.width - inset,
      y: isTop ? bandHeight / 2 : base.height + bandHeight / 2,
      anchor: isLeft ? 'start' : 'end',
      fontSize,
      fontFamily: label.fontFamily,
      fontWeight: label.fontWeight,
      color: label.color,
      textLength: textWidth > available ? available : undefined,
      badge: null,
      clip: null,
    },
  };
}

function layoutCenter(base: Layout, moduleCount: number, label: ResolvedLabel): Layout {
  const { unit } = base;
  const qrPx = moduleCount * unit;
  const maxWidth = qrPx * CENTER_MAX_WIDTH;
  const maxHeight = qrPx * CENTER_MAX_HEIGHT;
  const maxArea = qrPx * qrPx * CENTER_MAX_AREA;

  let fontSize = label.fontSize ?? qrPx * 0.08;
  let padding = label.padding ?? fontSize * 0.35;
  const measure = (): { width: number; height: number } => ({
    width: estimateTextWidth(label.text, fontSize, label.fontWeight) + padding * 2,
    height: fontSize * 1.2 + padding * 2,
  });

  let box = measure();
  const scale = Math.min(
    1,
    maxWidth / box.width,
    maxHeight / box.height,
    Math.sqrt(maxArea / (box.width * box.height)),
  );
  fontSize *= scale;
  padding *= scale;
  box = measure();

  // Below this the text becomes unreadable; keep the size and squeeze glyphs horizontally instead.
  const minFontSize = Math.max(6, unit * 1.6);
  let textLength: number | undefined;
  if (fontSize < minFontSize) {
    fontSize = minFontSize;
    padding = label.padding !== undefined ? Math.min(label.padding, fontSize * 0.35) : fontSize * 0.35;
    box = measure();
    if (box.width > maxWidth) {
      box = { width: maxWidth, height: box.height };
      textLength = maxWidth - padding * 2;
    }
  }

  // Snap to whole modules, keeping the box centred on the module grid.
  const snap = (px: number): number => {
    let modules = Math.ceil(px / unit - 1e-9);
    if ((moduleCount - modules) % 2 !== 0) modules++;
    return Math.min(modules, moduleCount);
  };
  textLength ??= estimateTextWidth(label.text, fontSize, label.fontWeight);

  const widthModules = snap(box.width);
  const heightModules = snap(box.height);
  const x0 = (moduleCount - widthModules) / 2;
  const y0 = (moduleCount - heightModules) / 2;
  const badgeHeight = heightModules * unit;
  const badgeX = base.qrX + x0 * unit;
  const badgeY = base.qrY + y0 * unit;

  return {
    ...base,
    excavation: { x0, y0, x1: x0 + widthModules, y1: y0 + heightModules },
    label: {
      text: label.text,
      x: base.qrX + qrPx / 2,
      y: base.qrY + qrPx / 2,
      anchor: 'middle',
      fontSize,
      fontFamily: label.fontFamily,
      fontWeight: label.fontWeight,
      color: label.color,
      textLength,
      badge: {
        x: badgeX,
        y: badgeY,
        width: widthModules * unit,
        height: badgeHeight,
        rx: Math.min(unit * 1.5, badgeHeight / 2),
        fill: label.background,
      },
      clip: { x: badgeX, y: badgeY, width: widthModules * unit, height: badgeHeight },
    },
  };
}

/** Label drawn inside the bottom-right corner of the symbol, replacing the modules under it. */
function layoutInsideCorner(base: Layout, moduleCount: number, label: ResolvedLabel): Layout {
  const { unit } = base;
  const padding = label.padding ?? unit * 0.5;
  // Largest font whose line box (1.1em) plus padding fits in the allowed rows.
  const maxFontSize = Math.max(1, (INSIDE_MAX_ROWS * unit - padding * 2) / 1.1);
  const maxColumns = Math.floor(moduleCount * INSIDE_MAX_WIDTH);
  const maxWidth = maxColumns * unit;

  // Long names shrink to fit the width before glyphs get squeezed: squeezed text forms a dense dark
  // block that throws scanners off far more than the modules it replaces.
  const widthPerPx = estimateTextWidth(label.text, 1, label.fontWeight);
  const fitFontSize = (maxWidth - padding * 2) / widthPerPx;
  const minFontSize = Math.min(maxFontSize, unit * 1.6);
  const fontSize = Math.max(minFontSize, Math.min(label.fontSize ?? maxFontSize, maxFontSize, fitFontSize));
  const textWidth = widthPerPx * fontSize;
  const overflow = textWidth + padding * 2 > maxWidth;

  const columns = overflow ? maxColumns : Math.ceil((textWidth + padding * 2) / unit - 1e-9);
  const rows = Math.min(INSIDE_MAX_ROWS, Math.ceil((fontSize * 1.1 + padding * 2) / unit - 1e-9));
  const right = base.qrX + moduleCount * unit;
  const bottom = base.qrY + moduleCount * unit;

  return {
    ...base,
    excavation: { x0: moduleCount - columns, y0: moduleCount - rows, x1: moduleCount, y1: moduleCount },
    label: {
      text: label.text,
      x: right - padding,
      y: base.qrY + (moduleCount - rows / 2) * unit,
      anchor: 'end',
      fontSize,
      fontFamily: label.fontFamily,
      fontWeight: label.fontWeight,
      color: label.color,
      textLength: overflow ? maxWidth - padding * 2 : textWidth,
      badge: null,
      clip: { x: right - columns * unit, y: bottom - rows * unit, width: columns * unit, height: rows * unit },
    },
  };
}
