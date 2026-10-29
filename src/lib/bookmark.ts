import type { Bookmark } from '../types';

/**
 * Compute a bookmark for the block currently at `readingY` (0..1 fraction of the
 * scroll container's height).
 */
export function computeBookmark(
  containerEl: HTMLElement,
  translateEl: HTMLElement,
  readingY: number
): Bookmark | null {
  const containerRect = containerEl.getBoundingClientRect();
  const targetY = containerRect.top + readingY * containerRect.height;

  const blocks = translateEl.querySelectorAll<HTMLElement>('[data-block-id]');
  if (blocks.length === 0) return null;

  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const block of blocks) {
    const rect = block.getBoundingClientRect();
    if (rect.top <= targetY && rect.bottom >= targetY) {
      best = block;
      break;
    }
    const dist = Math.min(
      Math.abs(rect.top - targetY),
      Math.abs(rect.bottom - targetY)
    );
    if (dist < bestScore) {
      bestScore = dist;
      best = block;
    }
  }

  if (!best) return null;

  const rect = best.getBoundingClientRect();
  const blockProgress = Math.max(
    0,
    Math.min(1, (targetY - rect.top) / Math.max(rect.height, 1))
  );

  return {
    blockId: best.dataset.blockId!,
    blockProgress,
    pageNumber: Number(best.dataset.pageNumber ?? 0),
    savedAt: Date.now(),
  };
}

/**
 * Given a bookmark and current layout, compute the pixel offset needed to place
 * the bookmarked block at the reading position.
 */
export function restoreBookmarkOffset(
  containerEl: HTMLElement,
  translateEl: HTMLElement,
  bookmark: Bookmark,
  readingY: number
): number {
  let block = translateEl.querySelector<HTMLElement>(
    `[data-block-id="${bookmark.blockId}"]`
  );
  if (!block && bookmark.pageNumber) {
    block = translateEl.querySelector<HTMLElement>(
      `[data-page-number="${bookmark.pageNumber}"]`
    );
  }
  if (!block) return 0;

  const translateRect = translateEl.getBoundingClientRect();
  const blockRect = block.getBoundingClientRect();
  const yBlock = blockRect.top - translateRect.top; // position in untranslated space
  const blockHeight = blockRect.height;

  const readingPx = containerEl.clientHeight * readingY;
  const newOffset = yBlock + blockHeight * bookmark.blockProgress - readingPx;
  return Math.max(0, newOffset);
}