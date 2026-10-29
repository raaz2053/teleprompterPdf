import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export interface RawLine {
  text: string;
  y: number;
  fontSize: number;
  page: number;
}

export interface ExtractedPdf {
  numPages: number;
  rawLinesPerPage: RawLine[][];
  avgCharsPerPage: number;
  likelyScanned: boolean;
}

function median(nums: number[]): number {
  if (!nums.length) return 12;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export async function extractPdf(
  file: File,
  onProgress?: (page: number, total: number) => void
): Promise<ExtractedPdf> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const rawLinesPerPage: RawLine[][] = [];
  let totalChars = 0;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const lines: RawLine[] = [];

    // Group items by rounded Y-coordinate → visual lines
    const byY = new Map<number, Array<{ str: string; x: number; size: number }>>();

    for (const item of content.items) {
      if (!('str' in item)) continue;
      const str = item.str;
      if (!str || !str.trim()) continue;

      const y = Math.round(item.transform[5]);
      const x = item.transform[4];
      const size =
        Math.hypot(item.transform[2], item.transform[3]) ||
        (item as { height?: number }).height ||
        12;

      const bucket = byY.get(y) ?? [];
      bucket.push({ str, x, size });
      byY.set(y, bucket);
      totalChars += str.length;
    }

    const ys = [...byY.keys()].sort((a, b) => b - a); // top → bottom
    for (const y of ys) {
      const items = byY.get(y)!.sort((a, b) => a.x - b.x);
      const text = items
        .map((i) => i.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!text) continue;

      const fontSize = median(items.map((i) => i.size));
      lines.push({ text, y, fontSize, page: pageNum });
    }

    rawLinesPerPage.push(lines);
    onProgress?.(pageNum, pdf.numPages);
  }

  const avgCharsPerPage = totalChars / Math.max(pdf.numPages, 1);

  return {
    numPages: pdf.numPages,
    rawLinesPerPage,
    avgCharsPerPage,
    likelyScanned: avgCharsPerPage < 50,
  };
}