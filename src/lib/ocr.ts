import * as pdfjsLib from 'pdfjs-dist';
import type { RawLine } from './pdf-extract';

let tesseractMod: typeof import('tesseract.js') | null = null;

export async function runOcr(
  file: File,
  onProgress: (page: number, total: number, status: string) => void
): Promise<RawLine[][]> {
  if (!tesseractMod) {
    tesseractMod = await import('tesseract.js');
  }
  const { createWorker } = tesseractMod;
  const worker = await createWorker('eng');

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const result: RawLine[][] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    onProgress(pageNum, pdf.numPages, 'Rendering page…');
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2 });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context for OCR canvas');

    await page.render({ canvasContext: ctx, viewport }).promise;

    onProgress(pageNum, pdf.numPages, 'Recognizing text…');
    const { data } = await worker.recognize(canvas);

    const lines: RawLine[] = data.text
      .split('\n')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .map((text, i) => ({
        text,
        y: -i * 20,
        fontSize: 12,
        page: pageNum,
      }));

    result.push(lines);
    canvas.width = 0;
    canvas.height = 0;
  }

  await worker.terminate();
  return result;
}