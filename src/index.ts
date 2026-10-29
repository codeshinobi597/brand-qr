export { encode } from './encoder/encode';
export { QRCodeError, type QRCodeErrorCode } from './errors';
export { renderQRCode, toSVGDataURL, toSVGString, type QRCodeRender, type SvgNode } from './render/svg';
export type { Layout, LabelLayout, ModuleBox, Rect } from './render/layout';
export type * from './types';
