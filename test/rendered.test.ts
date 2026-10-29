import { describe, expect, it } from "vitest";
import { renderQRCode, type QRCodeOptions } from "../src";
import { serialize, type SvgNode } from "../src/render/svg";
import { decodeRaster, rasterize, TEST_FONTS } from "./raster";

// End-to-end checks on the real SVG, text included, rasterised by resvg with bundled fonts.
// Unlike the matrix-level tests, these catch label text drawn wider than the layout estimated.

function withoutText(tree: SvgNode): SvgNode {
  return { ...tree, children: tree.children.filter((c) => typeof c === "string" || c.tag !== "text") };
}

function scans(options: QRCodeOptions): boolean {
  return decodeRaster(rasterize(serialize(renderQRCode(options).tree))) === options.value;
}

/** Pixels the text changed: total, and how many fall outside the label box (1px antialiasing slack). */
function textFootprint(options: QRCodeOptions): { changed: number; outside: number } {
  const { tree, layout } = renderQRCode(options);
  const box = layout.excavation!;
  const left = layout.qrX + box.x0 * layout.unit - 1;
  const top = layout.qrY + box.y0 * layout.unit - 1;
  const right = layout.qrX + box.x1 * layout.unit + 1;
  const bottom = layout.qrY + box.y1 * layout.unit + 1;

  const a = rasterize(serialize(tree));
  const b = rasterize(serialize(withoutText(tree)));
  let changed = 0;
  let outside = 0;
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const i = (y * a.width + x) * 4;
      if (a.pixels[i] === b.pixels[i] && a.pixels[i + 1] === b.pixels[i + 1] && a.pixels[i + 2] === b.pixels[i + 2]) continue;
      changed++;
      if (x < left || x >= right || y < top || y >= bottom) outside++;
    }
  }
  return { changed, outside };
}

const URL = "https://example.com/menu?table=12";
const LONG = "https://example.com/" + "a".repeat(120);
const TEXTS = ["Acme", "WWWWWWWW", "MMMM MMMM", "The Extremely Long Company Name Ltd."];
const FONTS = [undefined, ...TEST_FONTS];
const LABELS = [
  { position: "center", placement: undefined },
  { position: "bottom-right", placement: "inside" },
] as const;

describe("rendered labels", () => {
  for (const { position, placement } of LABELS) {
    for (const text of TEXTS) {
      for (const fontFamily of FONTS) {
        const name = `${placement ?? position} ${JSON.stringify(text)} in ${fontFamily ?? "default font"}`;
        const label = { text, position, placement, fontFamily };

        it(`${name}: text stays inside its box`, () => {
          const { changed, outside } = textFootprint({ value: URL, size: 400, label });
          expect(changed, "text did not render at all").toBeGreaterThan(0);
          expect(outside).toBe(0);
        });

        it(`${name}: scans at several sizes and data lengths`, () => {
          for (const value of [URL, LONG]) {
            for (const size of [200, 290, 400, 510]) {
              for (const moduleShape of ["square", "dot"] as const) {
                expect(scans({ value, size, moduleShape, label }), `${value.length} chars, ${size}px, ${moduleShape}`).toBe(true);
              }
            }
          }
        });
      }
    }
  }

  it("scans without a label in every module shape", () => {
    for (const moduleShape of ["square", "rounded", "dot"] as const) {
      expect(scans({ value: URL, size: 300, moduleShape }), moduleShape).toBe(true);
    }
  });
});
