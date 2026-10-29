import { QRCodeError } from '../errors';
import type { EncodeOptions, ErrorCorrectionLevel, QRMatrix } from '../types';
import { penaltyScore } from './mask';
import { MatrixBuilder } from './matrix';
import { rsEncode } from './reedSolomon';
import { BitBuffer, makeSegment, segmentBits, writeSegment, type Segment } from './segments';
import {
  eccCodewordsPerBlock,
  MAX_VERSION,
  MIN_VERSION,
  numBlocks,
  numDataCodewords,
  numRawDataModules,
} from './tables';

const EC_LEVELS: readonly ErrorCorrectionLevel[] = ['L', 'M', 'Q', 'H'];

function assertVersion(name: string, value: number): void {
  if (!Number.isInteger(value) || value < MIN_VERSION || value > MAX_VERSION) {
    throw new QRCodeError('INVALID_OPTION', `${name} must be an integer between 1 and 40, got ${value}`);
  }
}

function chooseVersion(segment: Segment, level: ErrorCorrectionLevel, min: number, max: number): number {
  for (let version = min; version <= max; version++) {
    if (segmentBits(segment, version) <= numDataCodewords(level, version) * 8) return version;
  }
  throw new QRCodeError(
    'DATA_TOO_LONG',
    `Data (${segment.numChars} ${segment.mode === 'byte' ? 'bytes' : 'characters'}) does not fit in a version ${max} QR code at error correction level ${level}`,
  );
}

function buildDataCodewords(segment: Segment, level: ErrorCorrectionLevel, version: number): Uint8Array {
  const capacityBits = numDataCodewords(level, version) * 8;
  const buffer = new BitBuffer();
  writeSegment(buffer, segment, version);

  buffer.push(0, Math.min(4, capacityBits - buffer.length)); // terminator
  buffer.push(0, (8 - (buffer.length % 8)) % 8); // byte align
  for (let pad = 0xec; buffer.length < capacityBits; pad ^= 0xec ^ 0x11) buffer.push(pad, 8);

  const result = new Uint8Array(buffer.length / 8);
  buffer.bits.forEach((bit, i) => {
    result[i >>> 3] = result[i >>> 3]! | (bit << (7 - (i & 7)));
  });
  return result;
}

/** Splits data into blocks, appends Reed-Solomon ECC to each, and interleaves them. */
function addEccAndInterleave(data: Uint8Array, level: ErrorCorrectionLevel, version: number): Uint8Array {
  const blockCount = numBlocks(level, version);
  const eccLen = eccCodewordsPerBlock(level, version);
  const rawCodewords = Math.floor(numRawDataModules(version) / 8);
  const numShortBlocks = blockCount - (rawCodewords % blockCount);
  const shortBlockLen = Math.floor(rawCodewords / blockCount);

  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < blockCount; i++) {
    const dataLen = shortBlockLen - eccLen + (i < numShortBlocks ? 0 : 1);
    const blockData = Array.from(data.subarray(k, k + dataLen));
    k += dataLen;
    const ecc = Array.from(rsEncode(blockData, eccLen));
    if (i < numShortBlocks) blockData.push(0); // placeholder so all blocks align
    blocks.push(blockData.concat(ecc));
  }

  const result = new Uint8Array(rawCodewords);
  let n = 0;
  const blockLen = blocks[0]!.length;
  for (let i = 0; i < blockLen; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortBlockLen - eccLen || j >= numShortBlocks) result[n++] = block[i]!;
    });
  }
  return result;
}

/** Encodes `value` into a QR module matrix. */
export function encode(value: string, options: EncodeOptions = {}): QRMatrix {
  const level = options.errorCorrection ?? 'M';
  const minVersion = options.minVersion ?? MIN_VERSION;
  const maxVersion = options.maxVersion ?? MAX_VERSION;
  if (!EC_LEVELS.includes(level)) {
    throw new QRCodeError('INVALID_OPTION', `errorCorrection must be one of L, M, Q, H, got ${String(level)}`);
  }
  assertVersion('minVersion', minVersion);
  assertVersion('maxVersion', maxVersion);
  if (minVersion > maxVersion) throw new QRCodeError('INVALID_OPTION', 'minVersion must be <= maxVersion');
  if (options.mask !== undefined && !(Number.isInteger(options.mask) && options.mask >= 0 && options.mask <= 7)) {
    throw new QRCodeError('INVALID_OPTION', `mask must be an integer between 0 and 7, got ${options.mask}`);
  }

  const segment = makeSegment(value);
  const version = chooseVersion(segment, level, minVersion, maxVersion);
  const codewords = addEccAndInterleave(buildDataCodewords(segment, level, version), level, version);

  const matrix = new MatrixBuilder(version);
  matrix.drawFunctionPatterns(level);
  matrix.drawCodewords(codewords);

  let mask = options.mask;
  if (mask === undefined) {
    let bestScore = Infinity;
    for (let candidate = 0; candidate < 8; candidate++) {
      matrix.applyMask(candidate);
      matrix.drawFormatBits(level, candidate);
      const score = penaltyScore(matrix);
      if (score < bestScore) {
        bestScore = score;
        mask = candidate;
      }
      matrix.applyMask(candidate); // undo
    }
  }
  const chosenMask = mask ?? 0;
  matrix.applyMask(chosenMask);
  matrix.drawFormatBits(level, chosenMask);

  const { size, modules } = matrix;
  return Object.freeze({
    size,
    version,
    errorCorrection: level,
    mask: chosenMask,
    mode: segment.mode,
    isDark: (x: number, y: number): boolean =>
      x >= 0 && y >= 0 && x < size && y < size && modules[y * size + x] === 1,
    toArray: (): boolean[][] =>
      Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x) => modules[y * size + x] === 1)),
  });
}
