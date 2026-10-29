import type { MatrixBuilder } from './matrix';

const PENALTY_N1 = 3;
const PENALTY_N2 = 3;
const PENALTY_N3 = 40;
const PENALTY_N4 = 10;

const FINDER_LIKE = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
const FINDER_LIKE_REVERSED = [...FINDER_LIKE].reverse();

function matchesAt(line: Uint8Array, start: number, pattern: readonly number[]): boolean {
  for (let k = 0; k < pattern.length; k++) {
    if (line[start + k] !== pattern[k]) return false;
  }
  return true;
}

function linePenalty(line: Uint8Array): number {
  let result = 0;

  // Rule 1: runs of five or more same-colored modules.
  let runLength = 1;
  for (let i = 1; i <= line.length; i++) {
    if (i < line.length && line[i] === line[i - 1]) {
      runLength++;
    } else {
      if (runLength >= 5) result += PENALTY_N1 + (runLength - 5);
      runLength = 1;
    }
  }

  // Rule 3: finder-like 1:1:3:1:1 patterns with four light modules on one side.
  for (let i = 0; i + FINDER_LIKE.length <= line.length; i++) {
    if (matchesAt(line, i, FINDER_LIKE) || matchesAt(line, i, FINDER_LIKE_REVERSED)) result += PENALTY_N3;
  }

  return result;
}

/** ISO/IEC 18004 mask penalty score; lower is better. */
export function penaltyScore(matrix: MatrixBuilder): number {
  const { size, modules } = matrix;
  let result = 0;
  let dark = 0;

  const row = new Uint8Array(size);
  const col = new Uint8Array(size);
  for (let a = 0; a < size; a++) {
    for (let b = 0; b < size; b++) {
      row[b] = modules[a * size + b]!;
      col[b] = modules[b * size + a]!;
    }
    result += linePenalty(row) + linePenalty(col);
  }

  // Rule 2: 2x2 blocks of one color.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = modules[y * size + x]!;
      dark += c;
      if (
        x < size - 1 &&
        y < size - 1 &&
        c === modules[y * size + x + 1] &&
        c === modules[(y + 1) * size + x] &&
        c === modules[(y + 1) * size + x + 1]
      ) {
        result += PENALTY_N2;
      }
    }
  }

  // Rule 4: deviation of the dark ratio from 50%, in 5% steps.
  const total = size * size;
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  result += Math.max(0, k) * PENALTY_N4;

  return result;
}
