import { Resvg } from "@resvg/resvg-js";
import { BinaryBitmap, HybridBinarizer, QRCodeReader, RGBLuminanceSource } from "@zxing/library";
import jsQR from "jsqr";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

// Fonts ship with the dejavu-fonts-ttf dev dependency, so text renders the same on every OS and CI.
const FONT_DIR = join(dirname(createRequire(import.meta.url).resolve("dejavu-fonts-ttf/package.json")), "ttf");
const FONT_FILES = ["DejaVuSans", "DejaVuSans-Bold", "DejaVuSansMono", "DejaVuSansMono-Bold", "DejaVuSerif", "DejaVuSerif-Bold"].map(
  (name) => join(FONT_DIR, `${name}.ttf`),
);

/** Families available to rendered tests. Anything else (e.g. the default system-ui stack) falls back to DejaVu Sans. */
export const TEST_FONTS = ["DejaVu Sans", "DejaVu Sans Mono", "DejaVu Serif"] as const;

export interface Raster {
  pixels: Uint8Array;
  width: number;
  height: number;
}

export function rasterize(svg: string): Raster {
  const image = new Resvg(svg, {
    background: "#ffffff",
    font: { loadSystemFonts: false, fontFiles: FONT_FILES, defaultFontFamily: "DejaVu Sans" },
  }).render();
  // `image.pixels` copies the buffer on every access, so read it once.
  return { pixels: image.pixels, width: image.width, height: image.height };
}

/**
 * Decodes with ZXing, the decoder family behind most phone scanner apps. jsQR is stricter: it
 * cannot read dot modules at all and misses some valid codes, so it is only used on clean
 * matrix rasters (see helpers.ts).
 */
export function decodeRaster({ pixels, width, height }: Raster): string | null {
  const luminance = new Uint8ClampedArray(width * height);
  for (let i = 0; i < luminance.length; i++) {
    luminance[i] = (pixels[i * 4]! * 299 + pixels[i * 4 + 1]! * 587 + pixels[i * 4 + 2]! * 114) / 1000;
  }
  try {
    const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(luminance, width, height)));
    return new QRCodeReader().decode(bitmap).getText();
  } catch {
    return null;
  }
}

export function decodeRasterJsQR({ pixels, width, height }: Raster): string | null {
  return jsQR(new Uint8ClampedArray(pixels), width, height)?.data ?? null;
}
