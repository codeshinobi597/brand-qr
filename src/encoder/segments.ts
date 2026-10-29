import type { EncodingMode } from '../types';

const ALPHANUMERIC_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
const NUMERIC_RE = /^[0-9]*$/;
const ALPHANUMERIC_RE = /^[0-9A-Z $%*+\-./:]*$/;

const MODE_INDICATOR: Record<EncodingMode, number> = { numeric: 0x1, alphanumeric: 0x2, byte: 0x4 };

/** Character-count field width for version ranges 1–9, 10–26, 27–40. */
const CHAR_COUNT_BITS: Record<EncodingMode, readonly [number, number, number]> = {
  numeric: [10, 12, 14],
  alphanumeric: [9, 11, 13],
  byte: [8, 16, 16],
};

export class BitBuffer {
  readonly bits: number[] = [];

  push(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  }

  get length(): number {
    return this.bits.length;
  }
}

export interface Segment {
  readonly mode: EncodingMode;
  /** Characters for numeric/alphanumeric, bytes for byte mode. */
  readonly numChars: number;
  readonly data: BitBuffer;
}

export function charCountBits(mode: EncodingMode, version: number): number {
  const widths = CHAR_COUNT_BITS[mode];
  return widths[version <= 9 ? 0 : version <= 26 ? 1 : 2];
}

/** Picks the most compact single mode able to represent `text`. */
export function makeSegment(text: string): Segment {
  if (NUMERIC_RE.test(text)) return makeNumeric(text);
  if (ALPHANUMERIC_RE.test(text)) return makeAlphanumeric(text);
  return makeBytes(new TextEncoder().encode(text));
}

function makeNumeric(digits: string): Segment {
  const data = new BitBuffer();
  for (let i = 0; i < digits.length; i += 3) {
    const chunk = digits.slice(i, i + 3);
    data.push(parseInt(chunk, 10), chunk.length * 3 + 1);
  }
  return { mode: 'numeric', numChars: digits.length, data };
}

function makeAlphanumeric(text: string): Segment {
  const data = new BitBuffer();
  let i = 0;
  for (; i + 2 <= text.length; i += 2) {
    const a = ALPHANUMERIC_CHARSET.indexOf(text.charAt(i));
    const b = ALPHANUMERIC_CHARSET.indexOf(text.charAt(i + 1));
    data.push(a * 45 + b, 11);
  }
  if (i < text.length) data.push(ALPHANUMERIC_CHARSET.indexOf(text.charAt(i)), 6);
  return { mode: 'alphanumeric', numChars: text.length, data };
}

function makeBytes(bytes: Uint8Array): Segment {
  const data = new BitBuffer();
  for (const b of bytes) data.push(b, 8);
  return { mode: 'byte', numChars: bytes.length, data };
}

/** Total bits the segment occupies at `version`, or `Infinity` if its length cannot be encoded. */
export function segmentBits(segment: Segment, version: number): number {
  const ccBits = charCountBits(segment.mode, version);
  if (segment.numChars >= 1 << ccBits) return Infinity;
  return 4 + ccBits + segment.data.length;
}

export function writeSegment(buffer: BitBuffer, segment: Segment, version: number): void {
  buffer.push(MODE_INDICATOR[segment.mode], 4);
  buffer.push(segment.numChars, charCountBits(segment.mode, version));
  for (const bit of segment.data.bits) buffer.bits.push(bit);
}
