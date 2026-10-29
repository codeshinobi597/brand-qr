import { QRCodeError } from '../errors';
import type {
  ErrorCorrectionLevel,
  FinderShape,
  FontWeight,
  LabelPlacement,
  LabelPosition,
  ModuleShape,
  QRCodeOptions,
} from '../types';
import { assertColor, contrastRatio, isDarker } from './colors';

const LABEL_POSITIONS: readonly LabelPosition[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'];
const LABEL_PLACEMENTS: readonly LabelPlacement[] = ['outside', 'inside'];
const MODULE_SHAPES: readonly ModuleShape[] = ['square', 'rounded', 'dot'];
const FINDER_SHAPES: readonly FinderShape[] = ['square', 'rounded'];
const EC_LEVELS: readonly ErrorCorrectionLevel[] = ['L', 'M', 'Q', 'H'];

const DEFAULT_FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const MIN_CONTRAST = 3;

export interface ResolvedLabel {
  text: string;
  position: LabelPosition;
  placement: LabelPlacement;
  color: string;
  background: string;
  fontFamily: string;
  fontSize: number | undefined;
  fontWeight: FontWeight;
  padding: number | undefined;
}

export interface ResolvedOptions {
  value: string;
  size: number;
  margin: number;
  errorCorrection: ErrorCorrectionLevel;
  foreground: string;
  background: string;
  finder: string;
  moduleShape: ModuleShape;
  finderShape: FinderShape;
  label: ResolvedLabel | null;
  title: string | undefined;
}

// Declared locally so the library doesn't depend on @types/node. Written as `process.env.NODE_ENV`
// so bundlers (Next.js, Vite, webpack) can statically replace it.
declare const process: { env: { NODE_ENV?: string } } | undefined;

function isDev(): boolean {
  return typeof process === 'undefined' || process.env.NODE_ENV !== 'production';
}

function warn(message: string): void {
  if (isDev()) console.warn(`[brand-qr] ${message}`);
}

function assertOneOf<T extends string>(name: string, value: T, allowed: readonly T[]): void {
  if (!allowed.includes(value)) {
    throw new QRCodeError('INVALID_OPTION', `${name} must be one of ${allowed.join(', ')}, got ${String(value)}`);
  }
}

function assertPositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new QRCodeError('INVALID_OPTION', `${name} must be a positive number, got ${value}`);
  }
}

function assertNonNegative(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new QRCodeError('INVALID_OPTION', `${name} must be a non-negative number, got ${value}`);
  }
}

/** Validates user options and fills in defaults. */
export function resolveOptions(options: QRCodeOptions): ResolvedOptions {
  if (typeof options.value !== 'string') {
    throw new QRCodeError('INVALID_OPTION', 'value must be a string');
  }

  const size = options.size ?? 256;
  assertPositive('size', size);

  const margin = options.margin ?? 4;
  if (!Number.isInteger(margin) || margin < 0) {
    throw new QRCodeError('INVALID_OPTION', `margin must be a non-negative integer, got ${margin}`);
  }

  const foreground = options.colors?.foreground ?? '#000000';
  const background = options.colors?.background ?? '#ffffff';
  const finder = options.colors?.finder ?? foreground;
  assertColor('colors.foreground', foreground);
  assertColor('colors.background', background);
  assertColor('colors.finder', finder);

  const moduleShape = options.moduleShape ?? 'square';
  assertOneOf('moduleShape', moduleShape, MODULE_SHAPES);
  const finderShape = options.finderShape ?? (moduleShape === 'square' ? 'square' : 'rounded');
  assertOneOf('finderShape', finderShape, FINDER_SHAPES);

  let errorCorrection = options.errorCorrection ?? 'M';
  assertOneOf('errorCorrection', errorCorrection, EC_LEVELS);

  // The label is optional: no label, or a blank company name, renders the plain full-size code.
  let label: ResolvedLabel | null = null;
  const labelText = options.label?.text.trim() ?? '';
  if (options.label && labelText.length > 0) {
    const l = options.label;
    assertOneOf('label.position', l.position, LABEL_POSITIONS);
    const placement = l.placement ?? 'outside';
    assertOneOf('label.placement', placement, LABEL_PLACEMENTS);
    if (placement === 'inside' && l.position !== 'bottom-right' && l.position !== 'center') {
      throw new QRCodeError(
        'INVALID_OPTION',
        `label.placement 'inside' is only supported for 'bottom-right'; '${l.position}' holds a finder pattern`,
      );
    }
    if (l.fontSize !== undefined) assertPositive('label.fontSize', l.fontSize);
    if (l.padding !== undefined) assertNonNegative('label.padding', l.padding);
    const color = l.color ?? foreground;
    const labelBackground = l.background ?? background;
    assertColor('label.color', color);
    assertColor('label.background', labelBackground);

    label = {
      text: labelText,
      position: l.position,
      placement,
      color,
      background: labelBackground,
      fontFamily: l.fontFamily ?? DEFAULT_FONT,
      fontSize: l.fontSize,
      fontWeight: l.fontWeight ?? 'bold',
      padding: l.padding,
    };

    if (l.position === 'center' && errorCorrection !== 'H') {
      if (options.errorCorrection !== undefined) {
        warn(`errorCorrection '${errorCorrection}' raised to 'H' so the center label does not break scanning.`);
      }
      errorCorrection = 'H';
    }

    // An inside corner label removes a strip of modules; Q (~25% recovery) keeps that well within budget.
    if (l.position === 'bottom-right' && placement === 'inside' && (errorCorrection === 'L' || errorCorrection === 'M')) {
      if (options.errorCorrection !== undefined) {
        warn(`errorCorrection '${errorCorrection}' raised to 'Q' so the inside label does not break scanning.`);
      }
      errorCorrection = 'Q';
    }
  }

  if (background !== 'transparent') {
    const ratio = contrastRatio(foreground, background);
    if (ratio !== null && ratio < MIN_CONTRAST) {
      warn(`Low contrast between foreground and background (${ratio.toFixed(2)}:1); the code may not scan.`);
    }
    if (isDarker(foreground, background) === false) {
      warn('Foreground is lighter than background; many scanners cannot read inverted QR codes.');
    }
  }

  return {
    value: options.value,
    size,
    margin,
    errorCorrection,
    foreground,
    background,
    finder,
    moduleShape,
    finderShape,
    label,
    title: options.title,
  };
}
