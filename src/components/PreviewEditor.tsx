import { useMemo, useState } from 'react';
import { useAppStore } from '../store';

export function PreviewEditor() {
  const doc = useAppStore((s) => s.doc);
  const setScreen = useAppStore((s) => s.setScreen);
  const togglePage = useAppStore((s) => s.togglePage);
  const clearBookmark = useAppStore((s) => s.clearBookmark);
  const reset = useAppStore((s) => s.reset);
  const [selectedPage, setSelectedPage] = useState<number | null>(
    doc?.bookmark?.pageNumber ?? doc?.pages[0]?.pageNumber ?? null
  );

  const stats = useMemo(() => {
    if (!doc) return { words: 0, chars: 0, includedPages: 0 };
    let words = 0;
    let chars = 0;
    let included = 0;
    for (const p of doc.pages) {
      if (!p.isIncluded) continue;
      included++;
      for (const b of p.blocks) {
        chars += b.text.length;
        words += b.text.split(/\s+/).filter(Boolean).length;
      }
    }
    return { words, chars, includedPages: included };
  }, [doc]);

  if (!doc) return null;

  const currentPage =
    doc.pages.find((p) => p.pageNumber === selectedPage) ?? doc.pages[0];
  const readMinutes = stats.words / 140;
  const bookmark = doc.bookmark;

  return (
    <div className="preview">
      <header className="preview-header">
        <button className="ghost" onClick={reset}>
          ← Library
        </button>
        <h2 title={doc.title}>{doc.title}</h2>
        <button
          className="primary"
          onClick={() => setScreen('prompter')}
          disabled={stats.words === 0}
        >
          {bookmark ? `Resume from page ${bookmark.pageNumber} →` : 'Start prompting →'}
        </button>
      </header>

      {bookmark && (
        <div className="bookmark-banner">
          <span>
            📖 You left off on page {bookmark.pageNumber}
            {bookmark.pageNumber <= doc.pages.length && currentPage && (
              <> of {doc.pages.length}</>
            )}
            .
          </span>
          <button className="ghost small" onClick={clearBookmark}>
            Clear bookmark
          </button>
        </div>
      )}

      <div className="preview-body">
        <aside className="page-list">
          <div className="page-list-header">
            Pages ({stats.includedPages}/{doc.pages.length})
          </div>
          {doc.pages.map((p) => {
            const wordCount = p.blocks.reduce(
              (n, b) => n + b.text.split(/\s+/).filter(Boolean).length,
              0
            );
            const isBookmarked = bookmark?.pageNumber === p.pageNumber;
            return (
              <div
                key={p.pageNumber}
                className={`page-item ${
                  p.pageNumber === currentPage.pageNumber ? 'active' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={p.isIncluded}
                  onChange={() => togglePage(p.pageNumber)}
                  aria-label={`Include page ${p.pageNumber}`}
                />
                <button
                  type="button"
                  className="page-number"
                  onClick={() => setSelectedPage(p.pageNumber)}
                >
                  <span>
                    Page {p.pageNumber}
                    {isBookmarked && <span className="bookmark-dot"> 📖</span>}
                  </span>
                  <span className="page-word-count">{wordCount}w</span>
                </button>
              </div>
            );
          })}
        </aside>

        <main className="page-content">
          <h3>Page {currentPage.pageNumber}</h3>
          {currentPage.blocks.length === 0 && (
            <p className="empty">No text on this page.</p>
          )}
          {currentPage.blocks.map((b) =>
            b.type === 'heading' ? (
              <p key={b.id} className="block-heading">
                {b.text}
              </p>
            ) : (
              <p key={b.id} className="block-para">
                {b.text}
              </p>
            )
          )}
        </main>
      </div>

      <footer className="preview-footer">
        <span>{stats.words.toLocaleString()} words</span>
        <span>~{readMinutes.toFixed(1)} min at 140 WPM</span>
      </footer>
    </div>
  );
}