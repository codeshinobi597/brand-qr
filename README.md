# brand-qr

A zero-dependency, strictly typed QR code generator for React and Next.js with custom colors, module shapes, and a company-name label.

- **Own encoder.** No runtime dependencies. Supports QR versions 1–40, error correction L/M/Q/H, and numeric, alphanumeric and UTF-8 byte modes.
- **SVG output.** It's crisp at any size, and SSR and React Server Component safe because it uses no hooks and no DOM.
- **Labels.** Place a label at `top-left`, `top-right`, `bottom-left`, `bottom-right` or `center`.
- **Styling.** Set the foreground, background and finder colors, and choose `square`, `rounded` or `dot` modules.
- **Downloads.** Optional browser helpers save the code as PNG or SVG.

## Install

```bash
npm install brand-qr
```

`react` (18 or 19) is an optional peer dependency. You only need it for `brand-qr/react`.

## React / Next.js

```tsx
import { QRCode } from 'brand-qr/react';

export default function Page() {
  return (
    <QRCode
      value="https://example.com"
      size={256}
      colors={{ foreground: '#1e3a8a', background: '#ffffff', finder: '#dc2626' }}
      moduleShape="rounded"
      label={{ text: 'Acme Inc.', position: 'bottom-right' }}
      className="qr"
    />
  );
}
```

`<QRCode />` works in App Router **Server Components** without `'use client'`. Any extra SVG props (`className`, `style`, `aria-label`, …) are passed through to the `<svg>`.

### Download button (client component)

```tsx
'use client';
import { downloadQRCode } from 'brand-qr/client';

export function DownloadButton() {
  return (
    <button
      onClick={() =>
        downloadQRCode(
          { value: 'https://example.com', label: { text: 'Acme', position: 'center' } },
          { filename: 'acme-qr', format: 'png', scale: 3 },
        )
      }
    >
      Download
    </button>
  );
}
```

### API route (framework-agnostic)

```ts
// app/api/qr/route.ts
import { toSVGString } from 'brand-qr';

export function GET(request: Request) {
  const value = new URL(request.url).searchParams.get('value') ?? '';
  return new Response(toSVGString({ value, label: { text: 'Acme', position: 'top-left' } }), {
    headers: { 'Content-Type': 'image/svg+xml' },
  });
}
```

## Label positions

| Position | Behavior |
| --- | --- |
| `top-left`, `top-right` | A text band is added **above** the code. Text is aligned with the code's left or right edge. |
| `bottom-left`, `bottom-right` | A text band is added **below** the code. |
| `center` | The text sits on a badge in the middle of the code. Error correction is forced to `H` (with a dev warning if you asked for less). The badge covers less than 12% of the symbol. Long names shrink, and are then compressed horizontally, so the code stays scannable. |

Corner labels never cover the code itself, so they don't affect scanning.

### Inside the corner (`placement: 'inside'`)

To put the name **inside** the code, like a brand mark in the bottom-right corner, use:

```tsx
<QRCode value={url} label={{ text: 'Acme', position: 'bottom-right', placement: 'inside' }} />
```

- The image stays square. The text replaces a strip of squares up to 4 rows tall and 45% of the width, below the small alignment square near that corner.
- Error correction is raised to at least `Q`, so the code still scans.
- Only `bottom-right` supports this, because the other three corners hold the large position squares. Any other corner throws `INVALID_OPTION`.
- The font is sized to fit the strip, so on small codes the text is small too. Long names shrink first, and are squeezed horizontally only once they reach a minimum size.

The label is optional. If `label` is left out, or the text is empty or only spaces, you get the plain full-size square code: no text strip, no center badge, and your chosen error correction level unchanged. You can pass a company name that may be missing straight through:

```tsx
<QRCode value={url} label={{ text: company?.name ?? '', position: 'center' }} />
```

## Options

```ts
interface QRCodeOptions {
  value: string;
  size?: number;                    // px width incl. quiet zone (default 256)
  margin?: number;                  // quiet zone in modules (default 4)
  errorCorrection?: 'L' | 'M' | 'Q' | 'H'; // default 'M'
  colors?: {
    foreground?: string;            // default '#000000'
    background?: string;            // default '#ffffff', or 'transparent'
    finder?: string;                // corner squares, default = foreground
  };
  moduleShape?: 'square' | 'rounded' | 'dot'; // default 'square'
  finderShape?: 'square' | 'rounded';          // default follows moduleShape
  label?: {
    text: string;
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    placement?: 'outside' | 'inside'; // default 'outside'; 'inside' needs bottom-right
    color?: string;                 // default = foreground
    background?: string;            // center badge, default = background
    fontFamily?: string;
    fontSize?: number;              // px; corner default 6% of size, min 8
    fontWeight?: number | 'normal' | 'bold'; // default 'bold'
    padding?: number;               // px
  };
  title?: string;                   // accessible name, rendered as <title>
}
```

Colors accept hex, `rgb()`/`rgba()`, `hsl()`/`hsla()` and CSS color keywords. Invalid values throw a `QRCodeError` with code `INVALID_COLOR`. In development, you get a console warning when contrast is too low or the colors are inverted (light code on a dark background), because many scanners can't read those.

## Other exports

| Export | From | Description |
| --- | --- | --- |
| `toSVGString(options)` | `brand-qr` | Standalone SVG markup. |
| `toSVGDataURL(options)` | `brand-qr` | A `data:image/svg+xml` URL. |
| `encode(value, { errorCorrection, minVersion, maxVersion, mask })` | `brand-qr` | The raw module matrix (`size`, `version`, `isDark(x, y)`, `toArray()`). |
| `renderQRCode(options)` | `brand-qr` | The SVG node tree plus the computed layout, for custom renderers. |
| `QRCodeError` | `brand-qr` | Has a `code`: `DATA_TOO_LONG`, `INVALID_OPTION` or `INVALID_COLOR`. |
| `toPNGDataURL(options, { scale })` | `brand-qr/client` | PNG data URL. Browser only. |
| `downloadQRCode(options, { filename, format, scale })` | `brand-qr/client` | Saves a PNG or SVG file. Browser only. |

## Scanning notes

- **Labels can't spill onto the code.** Center and inside labels are drawn at a fixed width and clipped to their box, whatever font the browser picks.
- **Dot modules (`moduleShape: 'dot'`)** scan with phone cameras and ZXing-based scanners, but **not with [jsQR](https://github.com/cozmo/jsQR)**, which some web-based scanners use. Use `square` or `rounded` if your codes must work with those.
- Keep each module at least about 3px on screen. Below that, codes get unreliable with or without a label.

## Development

```bash
npm test          # vitest: encoder vectors, jsQR matrix decoding, real SVG renders (resvg) decoded with ZXing
npm run typecheck
npm run build     # tsup → build/ (ESM + CJS + .d.ts)
```

## License

MIT
