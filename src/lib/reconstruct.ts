import type { RawLine } from './pdf-extract';
import type { ScriptBlock, ScriptPage } from '../types';

const genId = () => Math.random().toString(36).slice(2, 10);

function median(nums: number[]): number {
  if (!nums.length) return 12;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function normalize(line: string): string {
  return line.replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Repeated header / footer detection.
 * Lines that appear (normalized) on >60% of pages in the top-2 or bottom-2
 * line slots are considered headers/footers.
 */
export function detectRepeatedHeaders(rawLinesPerPage: RawLine[][]): Set<string> {
  const pages = rawLinesPerPage.filter((p) => p.length > 0);
  if (pages.length < 3) return new Set();

  const counts = new Map<string, number>();

  for (const lines of pages) {
    const candidates = new Set<string>();
    for (const line of lines.slice(0, 2)) {
      const n = normalize(line.text);
      if (n.length > 2) candidates.add(n);
    }
    for (const line of lines.slice(-2)) {
      const n = normalize(line.text);
      if (n.length > 2) candidates.add(n);
    }
    for (const c of candidates) counts.set(c, (counts.get(c) ?? 0) + 1);
  }

  const threshold = Math.ceil(pages.length * 0.6);
  const out = new Set<string>();
  for (const [k, v] of counts) if (v >= threshold) out.add(k);
  return out;
}

export function stripHeaders(lines: RawLine[], headers: Set<string>): RawLine[] {
  if (!headers.size) return lines;
  return lines.filter((l) => !headers.has(normalize(l.text)));
}

export function groupIntoBlocks(lines: RawLine[], pageNumber: number): ScriptBlock[] {
  const blocks: ScriptBlock[] = [];
  if (!lines.length) return blocks;

  const medianFont = median(lines.map((l) => l.fontSize).filter((f) => f > 0));

  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    gaps.push(Math.abs(lines[i - 1].y - lines[i].y));
  }
  const medianGap = gaps.length ? median(gaps) : 20;

  let current: string[] = [];
  let isCurrentHeading = false;

  const flush = () => {
    const text = current.join(' ').replace(/\s+/g, ' ').trim();
    if (text) {
      blocks.push({
        id: genId(),
        type: isCurrentHeading ? 'heading' : 'paragraph',
        text,
        pageNumber,
      });
    }
    current = [];
    isCurrentHeading = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isHeading = line.fontSize >= medianFont * 1.2;

    if (i > 0) {
      const prev = lines[i - 1];
      const gap = Math.abs(prev.y - line.y);
      const fontChange =
        Math.abs(prev.fontSize - line.fontSize) / Math.max(prev.fontSize, 1);
      const bigGap = gap > medianGap * 1.6;
      const newHeading = isHeading && !isCurrentHeading;
      if (bigGap || newHeading || fontChange > 0.3) flush();
    }

    if (current.length === 0) isCurrentHeading = isHeading;
    current.push(line.text);
  }
  flush();

  return blocks;
}

export function buildPages(
  rawLinesPerPage: RawLine[][],
  options: { stripHeaders: boolean }
): ScriptPage[] {
  const headers = options.stripHeaders
    ? detectRepeatedHeaders(rawLinesPerPage)
    : new Set<string>();

  return rawLinesPerPage.map((lines, idx) => {
    const pageNumber = idx + 1;
    const cleaned = stripHeaders(lines, headers);
    const blocks = groupIntoBlocks(cleaned, pageNumber);
    return {
      pageNumber,
      blocks,
      rawText: blocks.map((b) => b.text).join('\n\n'),
      isIncluded: blocks.length > 0,
    };
  });
}

export function buildDocumentFromText(text: string): ScriptPage[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const blocks: ScriptBlock[] = paragraphs.map((p) => ({
    id: genId(),
    type: 'paragraph',
    text: p.replace(/\s+/g, ' '),
  }));

  return [
    {
      pageNumber: 1,
      blocks,
      rawText: paragraphs.join('\n\n'),
      isIncluded: true,
    },
  ];
}