import { encode } from '../encoder/encode';
import type { QRCodeOptions, QRMatrix } from '../types';
import { computeLayout, type Layout } from './layout';
import { resolveOptions, type ResolvedOptions } from './options';
import { findersPath, fmt, modulesPath } from './shapes';

export interface SvgNode {
  tag: 'svg' | 'title' | 'defs' | 'clipPath' | 'rect' | 'path' | 'g' | 'text';
  /** Attribute names use SVG (kebab-case) spelling; insertion order is preserved in output. */
  attrs: Record<string, string>;
  children: Array<SvgNode | string>;
}

export interface QRCodeRender {
  tree: SvgNode;
  matrix: QRMatrix;
  layout: Layout;
  options: ResolvedOptions;
}

/**
 * Deterministic id (FNV-1a) so server and client render identical markup. Codes with equal ids
 * also have equal clip rects, so several QR codes on one page can't clip each other wrongly.
 */
function clipId(parts: readonly (string | number)[]): string {
  let hash = 0x811c9dc5;
  for (const char of parts.join('|')) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193);
  }
  return `bqr-clip-${(hash >>> 0).toString(36)}`;
}

function node(tag: SvgNode['tag'], attrs: Record<string, string>, children: SvgNode['children'] = []): SvgNode {
  return { tag, attrs, children };
}

/** Encodes the value and builds a framework-agnostic SVG tree. */
export function renderQRCode(input: QRCodeOptions): QRCodeRender {
  const options = resolveOptions(input);
  const matrix = encode(options.value, { errorCorrection: options.errorCorrection });
  const layout = computeLayout(matrix.size, options);
  const { width, height, unit, qrX, qrY, label } = layout;

  const children: SvgNode[] = [];
  if (options.title) children.push(node('title', {}, [options.title]));
  if (options.background !== 'transparent') {
    children.push(node('rect', { width: fmt(width), height: fmt(height), fill: options.background }));
  }

  const moduleAttrs: Record<string, string> = {
    d: modulesPath(matrix, options.moduleShape, layout.excavation),
    fill: options.foreground,
  };
  if (options.moduleShape === 'square') moduleAttrs['shape-rendering'] = 'crispEdges';

  children.push(
    node('g', { transform: `translate(${fmt(qrX)} ${fmt(qrY)}) scale(${fmt(unit)})` }, [
      node('path', moduleAttrs),
      node('path', { d: findersPath(matrix.size, options.finderShape), fill: options.finder, 'fill-rule': 'evenodd' }),
    ]),
  );

  if (label) {
    if (label.badge && label.badge.fill !== 'transparent') {
      const { badge } = label;
      children.push(
        node('rect', {
          x: fmt(badge.x),
          y: fmt(badge.y),
          width: fmt(badge.width),
          height: fmt(badge.height),
          rx: fmt(badge.rx),
          fill: badge.fill,
        }),
      );
    }
    const textAttrs: Record<string, string> = {
      x: fmt(label.x),
      y: fmt(label.y),
      fill: label.color,
      'font-family': label.fontFamily,
      'font-size': fmt(label.fontSize),
      'font-weight': String(label.fontWeight),
      'text-anchor': label.anchor,
      'dominant-baseline': 'central',
    };
    if (label.textLength !== undefined) {
      textAttrs['textLength'] = fmt(label.textLength);
      textAttrs['lengthAdjust'] = 'spacingAndGlyphs';
    }
    if (label.clip) {
      const rect = {
        x: fmt(label.clip.x),
        y: fmt(label.clip.y),
        width: fmt(label.clip.width),
        height: fmt(label.clip.height),
      };
      const id = clipId([label.text, rect.x, rect.y, rect.width, rect.height]);
      children.push(node('defs', {}, [node('clipPath', { id }, [node('rect', rect)])]));
      textAttrs['clip-path'] = `url(#${id})`;
    }
    children.push(node('text', textAttrs, [label.text]));
  }

  const tree = node(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      width: fmt(width),
      height: fmt(height),
      viewBox: `0 0 ${fmt(width)} ${fmt(height)}`,
      role: 'img',
      'aria-label': options.title ?? (label ? `QR code: ${label.text}` : 'QR code'),
    },
    children,
  );

  return { tree, matrix, layout, options };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export function serialize(tree: SvgNode | string): string {
  if (typeof tree === 'string') return escapeXml(tree);
  const attrs = Object.entries(tree.attrs)
    .map(([k, v]) => ` ${k}="${escapeXml(v)}"`)
    .join('');
  if (tree.children.length === 0) return `<${tree.tag}${attrs}/>`;
  return `<${tree.tag}${attrs}>${tree.children.map(serialize).join('')}</${tree.tag}>`;
}

/** Renders the QR code to a standalone SVG string. Works on the server, in the browser, and in workers. */
export function toSVGString(options: QRCodeOptions): string {
  return serialize(renderQRCode(options).tree);
}

/** Same as {@link toSVGString}, as a `data:image/svg+xml` URL for `<img src>` or CSS. */
export function toSVGDataURL(options: QRCodeOptions): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(toSVGString(options))}`;
}
