import type { ErrorCorrectionLevel } from '../types';
import { alignmentPositions, EC_FORMAT_BITS } from './tables';

function getBit(value: number, index: number): boolean {
  return ((value >>> index) & 1) !== 0;
}

/** Mutable module grid used while building a symbol. Coordinates are (x = column, y = row). */
export class MatrixBuilder {
  readonly version: number;
  readonly size: number;
  readonly modules: Uint8Array;
  readonly isFunction: Uint8Array;

  constructor(version: number) {
    this.version = version;
    this.size = version * 4 + 17;
    this.modules = new Uint8Array(this.size * this.size);
    this.isFunction = new Uint8Array(this.size * this.size);
  }

  get(x: number, y: number): boolean {
    return this.modules[y * this.size + x] === 1;
  }

  private setFunction(x: number, y: number, dark: boolean): void {
    const i = y * this.size + x;
    this.modules[i] = dark ? 1 : 0;
    this.isFunction[i] = 1;
  }

  drawFunctionPatterns(level: ErrorCorrectionLevel): void {
    const { size } = this;

    for (let i = 0; i < size; i++) {
      this.setFunction(6, i, i % 2 === 0);
      this.setFunction(i, 6, i % 2 === 0);
    }

    this.drawFinder(3, 3);
    this.drawFinder(size - 4, 3);
    this.drawFinder(3, size - 4);

    const positions = alignmentPositions(this.version);
    const last = positions.length - 1;
    positions.forEach((py, i) => {
      positions.forEach((px, j) => {
        const overlapsFinder = (i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0);
        if (!overlapsFinder) this.drawAlignment(px, py);
      });
    });

    // Reserve format areas now; the real mask is written later.
    this.drawFormatBits(level, 0);
    this.drawVersion();
  }

  private drawFinder(cx: number, cy: number): void {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= this.size || y >= this.size) continue;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        this.setFunction(x, y, dist !== 2 && dist !== 4);
      }
    }
  }

  private drawAlignment(cx: number, cy: number): void {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        this.setFunction(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  drawFormatBits(level: ErrorCorrectionLevel, mask: number): void {
    const data = (EC_FORMAT_BITS[level] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const { size } = this;

    // Copy around the top-left finder.
    for (let i = 0; i <= 5; i++) this.setFunction(8, i, getBit(bits, i));
    this.setFunction(8, 7, getBit(bits, 6));
    this.setFunction(8, 8, getBit(bits, 7));
    this.setFunction(7, 8, getBit(bits, 8));
    for (let i = 9; i < 15; i++) this.setFunction(14 - i, 8, getBit(bits, i));

    // Split copy next to the other two finders.
    for (let i = 0; i < 8; i++) this.setFunction(size - 1 - i, 8, getBit(bits, i));
    for (let i = 8; i < 15; i++) this.setFunction(8, size - 15 + i, getBit(bits, i));
    this.setFunction(8, size - 8, true); // dark module
  }

  private drawVersion(): void {
    if (this.version < 7) return;
    let rem = this.version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (this.version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = getBit(bits, i);
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.setFunction(a, b, bit);
      this.setFunction(b, a, bit);
    }
  }

  /** Places interleaved codewords in the two-column zigzag order, skipping function modules. */
  drawCodewords(codewords: Uint8Array): void {
    const { size } = this;
    const totalBits = codewords.length * 8;
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5; // skip the vertical timing column
      const upward = ((right + 1) & 2) === 0;
      for (let vert = 0; vert < size; vert++) {
        const y = upward ? size - 1 - vert : vert;
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const idx = y * size + x;
          if (this.isFunction[idx] === 1 || i >= totalBits) continue;
          this.modules[idx] = getBit(codewords[i >>> 3]!, 7 - (i & 7)) ? 1 : 0;
          i++;
        }
      }
    }
  }

  /** XORs the mask over data modules. Applying the same mask twice undoes it. */
  applyMask(mask: number): void {
    const { size } = this;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = y * size + x;
        if (this.isFunction[idx] === 1) continue;
        if (maskBit(mask, x, y)) this.modules[idx] = this.modules[idx]! ^ 1;
      }
    }
  }
}

export function maskBit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    case 7: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: throw new RangeError(`Invalid mask ${mask}`);
  }
}
