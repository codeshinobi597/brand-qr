import { renderQRCode, serialize, toSVGDataURL } from '../render/svg';
import type { QRCodeOptions } from '../types';

export interface RasterOptions {
  /** Pixel density multiplier for sharper PNGs. Default `2`. */
  scale?: number;
}

export type DownloadFormat = 'png' | 'svg';

export interface DownloadOptions extends RasterOptions {
  /** File name without extension. Default `'qr-code'`. */
  filename?: string;
  /** Default `'png'`. */
  format?: DownloadFormat;
}

function assertBrowser(fn: string): void {
  if (typeof document === 'undefined') {
    throw new Error(`[brand-qr] ${fn}() needs a browser environment. Call it from an event handler or effect.`);
  }
}

/** Rasterises the QR code to a PNG data URL using a canvas. Browser only. */
export async function toPNGDataURL(options: QRCodeOptions, { scale = 2 }: RasterOptions = {}): Promise<string> {
  assertBrowser('toPNGDataURL');
  const { tree, layout } = renderQRCode(options);
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialize(tree))}`;
  await image.decode();

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(layout.width * scale);
  canvas.height = Math.round(layout.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('[brand-qr] Canvas 2D context is not available.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

/** Triggers a file download of the QR code as PNG or SVG. Browser only. */
export async function downloadQRCode(
  options: QRCodeOptions,
  { filename = 'qr-code', format = 'png', scale }: DownloadOptions = {},
): Promise<void> {
  assertBrowser('downloadQRCode');
  const href = format === 'svg' ? toSVGDataURL(options) : await toPNGDataURL(options, { scale });
  const link = document.createElement('a');
  link.href = href;
  link.download = `${filename}.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export type * from '../types';
