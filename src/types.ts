export type LabelPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';

/**
 * Where a corner label goes:
 * - `'outside'`: in a band above or below the code (the image grows taller).
 * - `'inside'`: inside the code's bottom-right corner, replacing modules (the image keeps its size).
 *   Only `bottom-right` supports this, as it is the only corner without a finder pattern.
 */
export type LabelPlacement = 'outside' | 'inside';

export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export type ModuleShape = 'square' | 'rounded' | 'dot';

export type FinderShape = 'square' | 'rounded';

export type EncodingMode = 'numeric' | 'alphanumeric' | 'byte';

export type FontWeight = number | 'normal' | 'bold';

export interface QRLabelOptions {
  /** Text to display, e.g. the company name. */
  text: string;
  position: LabelPosition;
  /** Corner labels only. Default `'outside'`. `'inside'` requires `position: 'bottom-right'`. */
  placement?: LabelPlacement;
  /** Text color. Defaults to `colors.foreground`. */
  color?: string;
  /** Badge color behind a `center` label. Defaults to `colors.background`. */
  background?: string;
  /** Defaults to `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`. */
  fontFamily?: string;
  /**
   * Font size in px. Defaults to 6% of `size` (at least 8px) for corner labels.
   * Center labels shrink to fit.
   */
  fontSize?: number;
  fontWeight?: FontWeight;
  /** Space around the text in px. Defaults to a fraction of the font size. */
  padding?: number;
}

export interface QRColors {
  /** Color of the data modules. Default `#000000`. */
  foreground?: string;
  /** Canvas color. Use `transparent` for no background. Default `#ffffff`. */
  background?: string;
  /** Color of the three finder (corner) squares. Defaults to `foreground`. */
  finder?: string;
}

export interface QRCodeOptions {
  /** The content to encode (URL, text, ...). */
  value: string;
  /** Width in px of the QR area including its quiet zone. Default `256`. */
  size?: number;
  /** Quiet zone width in modules. Default `4` (the spec minimum). */
  margin?: number;
  /**
   * Error correction level. Default `'M'`.
   * Raised to `'H'` automatically when a `center` label is used.
   */
  errorCorrection?: ErrorCorrectionLevel;
  colors?: QRColors;
  /** Default `'square'`. */
  moduleShape?: ModuleShape;
  /** Default `'square'` for square modules, `'rounded'` otherwise. */
  finderShape?: FinderShape;
  label?: QRLabelOptions;
  /** Accessible name, rendered as an SVG `<title>` (also shown as a tooltip). */
  title?: string;
}

export interface EncodeOptions {
  errorCorrection?: ErrorCorrectionLevel;
  /** Smallest QR version (1–40) to use. Default `1`. */
  minVersion?: number;
  /** Largest QR version (1–40) to use. Default `40`. */
  maxVersion?: number;
  /** Force a mask pattern (0–7). Chosen automatically by default. */
  mask?: number;
}

export interface QRMatrix {
  /** Number of modules per side (`version * 4 + 17`). */
  readonly size: number;
  readonly version: number;
  readonly errorCorrection: ErrorCorrectionLevel;
  readonly mask: number;
  readonly mode: EncodingMode;
  isDark(x: number, y: number): boolean;
  toArray(): boolean[][];
}
