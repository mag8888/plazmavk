/** Optional dependency for PDF image extraction. Resolved at runtime. */
declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  export function getDocument(opts: { data: Uint8Array }): {
    promise: Promise<{ numPages: number; getPage: (n: number) => Promise<unknown> }>;
  };
  export const OPS: { paintImageXObject: number; paintJpegXObject: number };
}
