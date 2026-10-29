import { createElement, type ReactElement, type SVGProps } from 'react';
import { renderQRCode, type SvgNode } from '../render/svg';
import type { QRCodeOptions } from '../types';

export type QRCodeProps = QRCodeOptions &
  Omit<SVGProps<SVGSVGElement>, keyof QRCodeOptions | 'children' | 'ref'>;

/** `fill-rule` -> `fillRule`; `aria-*`, `data-*` and `xmlns` stay as-is. */
function toReactProp(name: string): string {
  if (name.startsWith('aria-') || name.startsWith('data-')) return name;
  return name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function toReact(node: SvgNode | string, key: number): ReactElement | string {
  if (typeof node === 'string') return node;
  const props: Record<string, string | number> = { key };
  for (const [name, value] of Object.entries(node.attrs)) props[toReactProp(name)] = value;
  return createElement(node.tag, props, ...node.children.map(toReact));
}

/**
 * Renders a QR code as inline SVG.
 *
 * Has no hooks or browser APIs, so it works in React Server Components, SSR and the client.
 * Extra SVG props (`className`, `style`, `aria-label`, ...) are forwarded to the `<svg>` element.
 */
export function QRCode(props: QRCodeProps): ReactElement {
  const {
    value,
    size,
    margin,
    errorCorrection,
    colors,
    moduleShape,
    finderShape,
    label,
    title,
    ...svgProps
  } = props;
  const { tree } = renderQRCode({ value, size, margin, errorCorrection, colors, moduleShape, finderShape, label, title });

  const rootProps: Record<string, unknown> = {};
  for (const [name, attrValue] of Object.entries(tree.attrs)) rootProps[toReactProp(name)] = attrValue;
  return createElement('svg', { ...rootProps, ...svgProps }, ...tree.children.map(toReact));
}
