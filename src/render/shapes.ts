import type { FinderShape, ModuleShape, QRMatrix } from '../types';
import type { ModuleBox } from './layout';

// All path data here is in module units; the SVG scales it with a transform.

export function fmt(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
  if (r <= 0) return `M${fmt(x)} ${fmt(y)}h${fmt(w)}v${fmt(h)}h${fmt(-w)}z`;
  const iw = fmt(w - 2 * r);
  const ih = fmt(h - 2 * r);
  const rr = fmt(r);
  return (
    `M${fmt(x + r)} ${fmt(y)}h${iw}a${rr} ${rr} 0 0 1 ${rr} ${rr}v${ih}` +
    `a${rr} ${rr} 0 0 1 -${rr} ${rr}h-${iw}a${rr} ${rr} 0 0 1 -${rr} -${rr}v-${ih}` +
    `a${rr} ${rr} 0 0 1 ${rr} -${rr}z`
  );
}

/** True if (x, y) lies in one of the three 7x7 finder patterns. */
export function isFinderModule(x: number, y: number, size: number): boolean {
  const inLow = (v: number): boolean => v < 7;
  const inHigh = (v: number): boolean => v >= size - 7;
  return (inLow(x) && inLow(y)) || (inHigh(x) && inLow(y)) || (inLow(x) && inHigh(y));
}

function inBox(x: number, y: number, box: ModuleBox | null): boolean {
  return box !== null && x >= box.x0 && x < box.x1 && y >= box.y0 && y < box.y1;
}

/** Path for every dark data module, excluding finders and the excavated box. */
export function modulesPath(matrix: QRMatrix, shape: ModuleShape, excavation: ModuleBox | null): string {
  const { size } = matrix;
  const visible = (x: number, y: number): boolean =>
    matrix.isDark(x, y) && !isFinderModule(x, y, size) && !inBox(x, y, excavation);
  const parts: string[] = [];

  if (shape === 'square') {
    // Merge horizontal runs to keep the path short.
    for (let y = 0; y < size; y++) {
      let x = 0;
      while (x < size) {
        if (!visible(x, y)) {
          x++;
          continue;
        }
        const start = x;
        while (x < size && visible(x, y)) x++;
        parts.push(`M${start} ${y}h${x - start}v1h-${x - start}z`);
      }
    }
    return parts.join('');
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!visible(x, y)) continue;
      if (shape === 'rounded') {
        parts.push(roundedRect(x, y, 1, 1, 0.3));
      } else {
        parts.push(`M${fmt(x + 0.05)} ${y + 0.5}a.45 .45 0 1 0 .9 0a.45 .45 0 1 0 -.9 0z`);
      }
    }
  }
  return parts.join('');
}

/** Path for the three finder patterns; render with `fill-rule="evenodd"`. */
export function findersPath(size: number, shape: FinderShape): string {
  const corners: ReadonlyArray<readonly [number, number]> = [
    [0, 0],
    [size - 7, 0],
    [0, size - 7],
  ];
  const rounded = shape === 'rounded';
  return corners
    .map(
      ([x, y]) =>
        roundedRect(x, y, 7, 7, rounded ? 2 : 0) +
        roundedRect(x + 1, y + 1, 5, 5, rounded ? 1.4 : 0) +
        roundedRect(x + 2, y + 2, 3, 3, rounded ? 0.9 : 0),
    )
    .join('');
}
