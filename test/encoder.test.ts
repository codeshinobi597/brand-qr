import { describe, expect, it } from 'vitest';
import { encode, QRCodeError } from '../src';
import { rsEncode } from '../src/encoder/reedSolomon';
import { makeSegment } from '../src/encoder/segments';
import { alignmentPositions, numDataCodewords } from '../src/encoder/tables';
import type { ErrorCorrectionLevel } from '../src/types';
import { decodeMatrix } from './helpers';

const LEVELS: ErrorCorrectionLevel[] = ['L', 'M', 'Q', 'H'];

describe('reed-solomon', () => {
  it('matches the known "HELLO WORLD" 1-M vector', () => {
    const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
    expect(Array.from(rsEncode(data, 10))).toEqual([196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
  });
});

describe('tables', () => {
  it('has spec capacities', () => {
    expect(numDataCodewords('L', 1)).toBe(19);
    expect(numDataCodewords('H', 1)).toBe(9);
    expect(numDataCodewords('M', 10)).toBe(216);
    expect(numDataCodewords('L', 40)).toBe(2956);
    expect(numDataCodewords('H', 40)).toBe(1276);
  });

  it('has spec alignment positions', () => {
    expect(alignmentPositions(1)).toEqual([]);
    expect(alignmentPositions(2)).toEqual([6, 18]);
    expect(alignmentPositions(7)).toEqual([6, 22, 38]);
    expect(alignmentPositions(32)).toEqual([6, 34, 60, 86, 112, 138]);
    expect(alignmentPositions(40)).toEqual([6, 30, 58, 86, 114, 142, 170]);
  });
});

describe('segments', () => {
  it('chooses the most compact mode', () => {
    expect(makeSegment('0123456789').mode).toBe('numeric');
    expect(makeSegment('HELLO WORLD').mode).toBe('alphanumeric');
    expect(makeSegment('hello').mode).toBe('byte');
    expect(makeSegment('é').numChars).toBe(2); // UTF-8 bytes
  });
});

describe('encode', () => {
  it('produces the right symbol size', () => {
    const m = encode('HELLO WORLD', { errorCorrection: 'M' });
    expect(m.version).toBe(1);
    expect(m.size).toBe(21);
  });

  it('honours a forced mask', () => {
    expect(encode('abc', { mask: 5 }).mask).toBe(5);
  });

  it('throws DATA_TOO_LONG past version 40', () => {
    const tooLong = 'a'.repeat(3000);
    expect(() => encode(tooLong, { errorCorrection: 'L' })).toThrow(QRCodeError);
    try {
      encode(tooLong, { errorCorrection: 'L' });
    } catch (e) {
      expect((e as QRCodeError).code).toBe('DATA_TOO_LONG');
    }
  });

  it('rejects invalid options', () => {
    expect(() => encode('x', { minVersion: 0 })).toThrow(QRCodeError);
    expect(() => encode('x', { mask: 8 })).toThrow(QRCodeError);
  });

  const samples = [
    '0',
    '0123456789012345',
    'HELLO WORLD',
    'https://example.com/products/42?ref=qr',
    'Grüße aus München 🚀',
    'The quick brown fox jumps over the lazy dog. '.repeat(4),
  ];

  for (const level of LEVELS) {
    for (const text of samples) {
      it(`round-trips ${JSON.stringify(text.slice(0, 24))} at ${level}`, () => {
        expect(decodeMatrix(encode(text, { errorCorrection: level }))).toBe(text);
      });
    }
  }

  for (const version of [1, 2, 6, 7, 10, 14, 25, 32, 40]) {
    it(`round-trips at version ${version}`, () => {
      const m = encode('QR 2026', { minVersion: version, errorCorrection: 'Q' });
      expect(m.version).toBe(version);
      expect(decodeMatrix(m, undefined, 3)).toBe('QR 2026');
    });
  }

  for (let mask = 0; mask < 8; mask++) {
    it(`round-trips with mask ${mask}`, () => {
      expect(decodeMatrix(encode('mask test 123', { mask }))).toBe('mask test 123');
    });
  }

  it('fills a version 40-L symbol to capacity', () => {
    const text = 'x'.repeat(2953);
    const m = encode(text, { errorCorrection: 'L' });
    expect(m.version).toBe(40);
    expect(decodeMatrix(m, undefined, 3)).toBe(text);
  });
});
