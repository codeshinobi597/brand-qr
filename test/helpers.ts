import jsQR from 'jsqr';
import type { QRMatrix } from '../src/types';

export interface ModuleBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Rasterises a matrix to RGBA (optionally blanking a module box) and decodes it with jsQR. */
export function decodeMatrix(matrix: QRMatrix, blank?: ModuleBox, scale = 4, margin = 4): string | null {
  const dim = (matrix.size + margin * 2) * scale;
  const pixels = new Uint8ClampedArray(dim * dim * 4).fill(255);
  for (let y = 0; y < matrix.size; y++) {
    for (let x = 0; x < matrix.size; x++) {
      const blanked = blank && x >= blank.x0 && x < blank.x1 && y >= blank.y0 && y < blank.y1;
      if (blanked || !matrix.isDark(x, y)) continue;
      for (let py = 0; py < scale; py++) {
        for (let px = 0; px < scale; px++) {
          const i = (((y + margin) * scale + py) * dim + (x + margin) * scale + px) * 4;
          pixels[i] = 0;
          pixels[i + 1] = 0;
          pixels[i + 2] = 0;
        }
      }
    }
  }
  const result = jsQR(pixels, dim, dim, { inversionAttempts: 'dontInvert' });
  return result ? new TextDecoder().decode(new Uint8Array(result.binaryData)) : null;
}
