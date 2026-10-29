export type QRCodeErrorCode = 'DATA_TOO_LONG' | 'INVALID_OPTION' | 'INVALID_COLOR';

export class QRCodeError extends Error {
  readonly code: QRCodeErrorCode;

  constructor(code: QRCodeErrorCode, message: string) {
    super(message);
    this.name = 'QRCodeError';
    this.code = code;
  }
}
