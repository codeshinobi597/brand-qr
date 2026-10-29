import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  QRCodeError,
  renderQRCode,
  toSVGString,
  type LabelPosition,
} from "../src";
import { QRCode } from "../src/react";
import { decodeMatrix } from "./helpers";

const URL = "https://example.com/menu?table=12";
const CORNERS: LabelPosition[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];

afterEach(() => vi.restoreAllMocks());

describe("without a label", () => {
  const expectFullImage = (r: ReturnType<typeof renderQRCode>): void => {
    const { layout, matrix } = r;
    expect(layout.width).toBe(256);
    expect(layout.height).toBe(256);
    expect(layout.label).toBeNull();
    expect(layout.excavation).toBeNull();
    expect(matrix.errorCorrection).toBe("M");
    expect(decodeMatrix(matrix)).toBe(URL);
  };

  it("renders the full square code when label is omitted", () => {
    expectFullImage(renderQRCode({ value: URL }));
    const svg = toSVGString({ value: URL });
    expect(svg).not.toContain("<text");
    expect(svg).toContain('aria-label="QR code"');
  });

  for (const text of ["", "   "]) {
    for (const position of [...CORNERS, "center"] as LabelPosition[]) {
      it(`treats a blank name (${JSON.stringify(text)}) at ${position} as no label`, () => {
        const plain = renderQRCode({ value: URL });
        const blank = renderQRCode({ value: URL, label: { text, position } });
        expectFullImage(blank);
        expect(blank.matrix.toArray()).toEqual(plain.matrix.toArray());
        expect(toSVGString({ value: URL, label: { text, position } })).toBe(
          toSVGString({ value: URL }),
        );
      });
    }
  }

  it("trims surrounding whitespace from a real name", () => {
    const { layout } = renderQRCode({
      value: URL,
      label: { text: "  Acme  ", position: "top-left" },
    });
    expect(layout.label!.text).toBe("Acme");
  });
});

describe("corner labels", () => {
  for (const position of CORNERS) {
    it(`${position}: adds a band outside the QR and leaves modules untouched`, () => {
      const plain = renderQRCode({ value: URL, size: 300 });
      const labelled = renderQRCode({
        value: URL,
        size: 300,
        label: { text: "Acme Inc.", position },
      });
      const { layout } = labelled;
      const label = layout.label!;

      expect(layout.width).toBe(300);
      expect(layout.height).toBeGreaterThan(300);
      expect(layout.excavation).toBeNull();
      expect(labelled.matrix.toArray()).toEqual(plain.matrix.toArray());
      expect(labelled.matrix.errorCorrection).toBe("M");

      const isTop = position.startsWith("top");
      const isLeft = position.endsWith("left");
      expect(label.anchor).toBe(isLeft ? "start" : "end");
      expect(label.x < 150).toBe(isLeft);
      expect(label.y < layout.qrY).toBe(isTop);
      if (!isTop)
        expect(label.y).toBeGreaterThan(
          layout.qrY + labelled.matrix.size * layout.unit,
        );
      expect(layout.qrY).toBeCloseTo(
        isTop ? plain.layout.qrY + (layout.height - 300) : plain.layout.qrY,
        9,
      );
    });
  }

  it("keeps the default corner font readable on small codes", () => {
    const small = renderQRCode({ value: URL, size: 44, label: { text: "MURL app", position: "bottom-left" } });
    expect(small.layout.label!.fontSize).toBe(8);
    const large = renderQRCode({ value: URL, size: 400, label: { text: "MURL app", position: "bottom-left" } });
    expect(large.layout.label!.fontSize).toBe(24);
    const explicit = renderQRCode({ value: URL, size: 44, label: { text: "x", position: "top-left", fontSize: 5 } });
    expect(explicit.layout.label!.fontSize).toBe(5);
  });

  it("compresses text that would overflow the width", () => {
    const { layout } = renderQRCode({
      value: URL,
      size: 120,
      label: {
        text: "A Very Long Company Name Incorporated International",
        position: "bottom-left",
      },
    });
    expect(layout.label!.textLength).toBeDefined();
    expect(layout.label!.textLength!).toBeLessThanOrEqual(120);
  });
});

describe("center label", () => {
  it("forces error correction H and warns when the user asked for less", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = renderQRCode({
      value: URL,
      errorCorrection: "L",
      label: { text: "Acme", position: "center" },
    });
    expect(r.matrix.errorCorrection).toBe("H");
    expect(warn).toHaveBeenCalledOnce();
  });

  it("centres the excavated box on the module grid", () => {
    const { layout, matrix } = renderQRCode({
      value: URL,
      label: { text: "Acme", position: "center" },
    });
    const box = layout.excavation!;
    expect(box.x0).toBe(matrix.size - box.x1);
    expect(box.y0).toBe(matrix.size - box.y1);
    expect(layout.label!.badge).not.toBeNull();
  });

  const values = [
    "hi",
    URL,
    "https://example.com/" + "a".repeat(120),
    "x".repeat(600),
  ];
  const texts = [
    "A",
    "Acme",
    "Acme Corporation",
    "The Extremely Long Company Name Ltd.",
  ];
  for (const value of values) {
    for (const text of texts) {
      it(`still scans: ${value.length} chars, label ${JSON.stringify(text)}`, () => {
        const { matrix, layout } = renderQRCode({
          value,
          label: { text, position: "center" },
        });
        const box = layout.excavation!;
        const covered =
          ((box.x1 - box.x0) * (box.y1 - box.y0)) / (matrix.size * matrix.size);
        expect(covered).toBeLessThan(0.2);
        expect(decodeMatrix(matrix, box)).toBe(value);
      });
    }
  }
});

describe("inside bottom-right label", () => {
  const inside = (text: string, extra: object = {}) =>
    renderQRCode({ value: URL, size: 300, label: { text, position: "bottom-right", placement: "inside" }, ...extra });

  it("keeps the image square and replaces modules in the bottom-right corner", () => {
    const { layout, matrix } = inside("bitly");
    const box = layout.excavation!;
    expect(layout.width).toBe(300);
    expect(layout.height).toBe(300);
    expect(box.x1).toBe(matrix.size);
    expect(box.y1).toBe(matrix.size);
    expect(box.y1 - box.y0).toBeLessThanOrEqual(4); // stays below the alignment pattern
    expect(box.x0).toBeGreaterThan(8); // clear of the bottom-left finder and format bits
    expect(layout.label!.anchor).toBe("end");
    expect(layout.label!.badge).toBeNull();
  });

  it("raises error correction to at least Q", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(inside("bitly").matrix.errorCorrection).toBe("Q");
    expect(inside("bitly", { errorCorrection: "L" }).matrix.errorCorrection).toBe("Q");
    expect(inside("bitly", { errorCorrection: "H" }).matrix.errorCorrection).toBe("H");
  });

  it("rejects inside placement on corners that hold a finder pattern", () => {
    for (const position of ["top-left", "top-right", "bottom-left"] as const) {
      expect(() => toSVGString({ value: URL, label: { text: "x", position, placement: "inside" } })).toThrow(QRCodeError);
    }
  });

  const values = ["hi", URL, "https://example.com/" + "a".repeat(120), "x".repeat(600)];
  const texts = ["A", "bitly", "MURL app", "The Extremely Long Company Name Ltd."];
  for (const value of values) {
    for (const text of texts) {
      for (const size of [44, 300]) {
        it(`still scans: ${value.length} chars, ${JSON.stringify(text)}, ${size}px`, () => {
          const { matrix, layout } = renderQRCode({
            value,
            size,
            margin: 0,
            label: { text, position: "bottom-right", placement: "inside" },
          });
          expect(decodeMatrix(matrix, layout.excavation!)).toBe(value);
        });
      }
    }
  }
});

describe("svg output", () => {
  it("applies colors", () => {
    const svg = toSVGString({
      value: URL,
      colors: {
        foreground: "#1e3a8a",
        background: "#f0f9ff",
        finder: "rgb(220, 38, 38)",
      },
      label: {
        text: "Acme",
        position: "top-right",
        color: "hsl(200, 50%, 30%)",
      },
    });
    expect(svg).toContain('fill="#f0f9ff"');
    expect(svg).toContain('fill="#1e3a8a"');
    expect(svg).toContain('fill="rgb(220, 38, 38)"');
    expect(svg).toContain('fill="hsl(200, 50%, 30%)"');
  });

  it("omits the background rect when transparent", () => {
    const svg = toSVGString({
      value: URL,
      colors: { background: "transparent" },
    });
    expect(svg).not.toContain("<rect");
  });

  it("renders a title as <title> and aria-label", () => {
    const svg = toSVGString({ value: URL, title: "QR code for murl.co/abc" });
    expect(svg).toContain('aria-label="QR code for murl.co/abc"');
    expect(svg).toMatch(/^<svg [^>]+><title>QR code for murl\.co\/abc<\/title>/);
  });

  it("escapes label text", () => {
    const svg = toSVGString({
      value: URL,
      label: { text: '<b>"Tom" & Jerry\'s</b>', position: "top-left" },
    });
    expect(svg).toContain(
      "&lt;b&gt;&quot;Tom&quot; &amp; Jerry&#x27;s&lt;/b&gt;",
    );
    expect(svg).not.toContain("<b>");
  });

  for (const moduleShape of ["square", "rounded", "dot"] as const) {
    it(`renders ${moduleShape} modules`, () => {
      expect(toSVGString({ value: URL, moduleShape })).toMatch(
        /^<svg [^>]+>.*<\/svg>$/,
      );
    });
  }

  it("rejects invalid input", () => {
    expect(() =>
      toSVGString({ value: URL, colors: { foreground: 'red" onload="x' } }),
    ).toThrow(QRCodeError);
    expect(() => toSVGString({ value: URL, size: -1 })).toThrow(QRCodeError);
    expect(() => toSVGString({ value: URL, margin: 1.5 })).toThrow(QRCodeError);
    expect(() =>
      // @ts-expect-error invalid position is a type error too
      toSVGString({ value: URL, label: { text: "x", position: "middle" } }),
    ).toThrow(QRCodeError);
  });

  it("warns on low contrast and inverted colors", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    toSVGString({
      value: URL,
      colors: { foreground: "#dddddd", background: "#ffffff" },
    });
    toSVGString({
      value: URL,
      colors: { foreground: "#ffffff", background: "#000000" },
    });
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe("react", () => {
  const options = {
    value: URL,
    size: 200,
    moduleShape: "rounded" as const,
    colors: { foreground: "#0f172a" },
    label: { text: "Acme & Co", position: "center" as const },
  };

  it("matches toSVGString output", () => {
    // React writes empty elements as <path ...></path>; normalise to self-closing before comparing.
    const html = renderToStaticMarkup(createElement(QRCode, options)).replace(
      /<(\w+)([^<>]*)><\/\1>/g,
      "<$1$2/>",
    );
    expect(html).toBe(toSVGString(options));
  });

  it("forwards extra svg props", () => {
    const html = renderToStaticMarkup(
      createElement(QRCode, {
        value: URL,
        className: "qr",
        style: { maxWidth: "100%" },
        "aria-label": "Menu",
      }),
    );
    expect(html).toContain('class="qr"');
    expect(html).toContain('style="max-width:100%"');
    expect(html).toContain('aria-label="Menu"');
  });
});
