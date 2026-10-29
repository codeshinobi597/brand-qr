import { gfMul } from './gf256';

const generatorCache = new Map<number, Uint8Array>();

/**
 * Coefficients of the monic generator polynomial (x - a^0)(x - a^1)...(x - a^(degree-1)),
 * highest power first, with the leading 1 omitted.
 */
export function rsGenerator(degree: number): Uint8Array {
  const cached = generatorCache.get(degree);
  if (cached) return cached;

  const result = new Uint8Array(degree);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      let value = gfMul(result[j]!, root);
      if (j + 1 < degree) value ^= result[j + 1]!;
      result[j] = value;
    }
    root = gfMul(root, 0x02);
  }

  generatorCache.set(degree, result);
  return result;
}

/** Error correction codewords for `data` (polynomial remainder of data * x^degree / generator). */
export function rsEncode(data: ArrayLike<number>, degree: number): Uint8Array {
  const generator = rsGenerator(degree);
  const result = new Uint8Array(degree);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i]! ^ result[0]!;
    result.copyWithin(0, 1);
    result[degree - 1] = 0;
    for (let j = 0; j < degree; j++) result[j] = result[j]! ^ gfMul(generator[j]!, factor);
  }
  return result;
}
