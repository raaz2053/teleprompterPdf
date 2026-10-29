import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store';
import { ControlsOverlay } from './ControlsOverlay';
import { computeBookmark, restoreBookmarkOffset } from '../lib/bookmark';
import { updateBookmark } from '../lib/library';

const READING_Y = 0.25; // position of reading guide as fraction of viewport

export function Teleprompter() {
  const doc = useAppStore((s) => s.doc);
  const session = useAppStore((s) => s.session);
  const updateSession = useAppStore((s) => s.updateSession);
  const setScreen = useAppStore((s) => s.setScreen);
  const setBookmarkInStore = useAppStore((s) => s.setBookmark);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const speedRef = useRef(session.speedPxPerSec);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const playingRef = useRef(false);
  const hideTimerRef = useRef<number | null>(null);
  const pointerStateRef = useRef({
    down: false,
    startY: 0,
    lastY: 0,
    moved: false,
  });

  // NEW: Track current page and total available pages
  const [playing, setPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const lastPageUpdateRef = useRef(0);

  const docId = doc?.id;

  const includedPages = useMemo(() => {
    return doc?.pages.filter((p) => p.isIncluded).map((p) => p.pageNumber) ?? [];
  }, [doc?.pages]);

  const totalPages = includedPages.length;
  const maxPageNumber = includedPages[includedPages.length - 1] ?? 1;

  useEffect(() => {
    speedRef.current = session.speedPxPerSec;
  }, [session.speedPxPerSec]);

  const promptBlocks = useMemo(() => {
    if (!doc) return [];
    return doc.pages
      .filter((p) => p.isIncluded)
      .flatMap((p) => p.blocks.map((b) => ({ ...b, pageNumber: p.pageNumber })));
  }, [doc?.pages]);

  const clampOffset = useCallback((offset: number) => {
    const container = scrollContainerRef.current;
    const content = contentRef.current;
    if (!container || !content) return Math.max(0, offset);
    const maxOffset = Math.max(
      0,
      content.offsetHeight - container.clientHeight + 100
    );
    return Math.max(0, Math.min(offset, maxOffset));
  }, []);

  const applyOffset = useCallback(() => {
    if (contentRef.current) {
      contentRef.current.style.transform = `translate3d(0, ${-offsetRef.current}px, 0)`;
    }
  }, []);

  const scheduleHideControls = useCallback(() => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      if (playingRef.current) setShowControls(false);
    }, 3000);
  }, []);

  // NEW: Compute the current page based on scroll position
  const updateCurrentPage = useCallback(() => {
    if (!scrollContainerRef.current || !contentRef.current) return;
    const container = scrollContainerRef.current;
    const blocks = contentRef.current.querySelectorAll('[data-page-number]');
    if (!blocks.length) return;

    const readingPx = container.clientHeight * READING_Y;
    const targetY = offsetRef.current + readingPx;
    
    let current = Number(blocks[0].getAttribute('data-page-number')) || 1;
    
    for (const el of Array.from(blocks) as HTMLElement[]) {
      if (el.offsetTop <= targetY) {
        current = Number(el.getAttribute('data-page-number'));
      } else {
        break;
      }
    }
    
    if (current !== currentPage) {
      setCurrentPage(current);
    }
  }, [currentPage]);

  // NEW: Jump to a specific page
  const jumpToPage = useCallback((targetPage: number) => {
    if (!scrollContainerRef.current || !contentRef.current) return;
    if (playingRef.current) pause();
    
    const block = contentRef.current.querySelector(`[data-page-number="${targetPage}"]`);
    if (block) {
      const container = scrollContainerRef.current;
      const translateRect = contentRef.current.getBoundingClientRect();
      const blockRect = block.getBoundingClientRect();
      
      const yBlock = blockRect.top - translateRect.top;
      const readingPx = container.clientHeight * READING_Y;
      const newOffset = yBlock - readingPx;
      
      offsetRef.current = clampOffset(newOffset);
      applyOffset();
      setCurrentPage(targetPage);
      void saveBookmarkNow();
    }
  }, [clampOffset, applyOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveBookmarkNow = useCallback(async () => {
    if (!docId || !scrollContainerRef.current || !contentRef.current) return;
    const bm = computeBookmark(
      scrollContainerRef.current,
      contentRef.current,
      READING_Y
    );
    if (!bm) return;
    setBookmarkInStore(bm);
    try {
      await updateBookmark(docId, bm);
    } catch (err) {
      console.error('Failed to save bookmark', err);
    }
  }, [docId, setBookmarkInStore]);

  const pause = useCallback(() => {
    if (!playingRef.current) return;
    playingRef.current = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastTsRef.current = null;
    setPlaying(false);
    setShowControls(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    void saveBookmarkNow();
  }, [saveBookmarkNow]);

  const tick = useCallback(
    (timestamp: number) => {
      if (lastTsRef.current !== null) {
        const dt = (timestamp - lastTsRef.current) / 1000;
        offsetRef.current += speedRef.current * dt;
        applyOffset();

        // Throttle page number updates to avoid React lag
        if (timestamp - lastPageUpdateRef.current > 250) {
          updateCurrentPage();
          lastPageUpdateRef.current = timestamp;
        }

        const container = scrollContainerRef.current;
        const content = contentRef.current;
        if (container && content) {
          const max = content.offsetHeight - container.clientHeight * 0.85;
          if (max > 0 && offsetRef.current >= max) {
            offsetRef.current = max;
            applyOffset();
            pause();
            return;
          }
        }
      }
      lastTsRef.current = timestamp;
      rafRef.current = requestAnimationFrame(tick);
    },
    [applyOffset, pause, updateCurrentPage]
  );

  const play = useCallback(() => {
    if (playingRef.current) return;
    playingRef.current = true;
    lastTsRef.current = null;
    setPlaying(true);
    rafRef.current = requestAnimationFrame(tick);
    scheduleHideControls();
  }, [tick, scheduleHideControls]);

  const togglePlay = useCallback(() => {
    if (playingRef.current) pause();
    else play();
  }, [pause, play]);

  const restart = useCallback(() => {
    offsetRef.current = 0;
    applyOffset();
    setCurrentPage(includedPages[0] || 1);
    void saveBookmarkNow();
  }, [applyOffset, saveBookmarkNow, includedPages]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  const bumpSpeed = useCallback(
    (delta: number) => {
      updateSession({
        speedPxPerSec: Math.max(5, Math.min(300, session.speedPxPerSec + delta)),
      });
    },
    [session.speedPxPerSec, updateSession]
  );

  const bumpFont = useCallback(
    (delta: number) => {
      updateSession({
        fontSizePx: Math.max(24, Math.min(140, session.fontSizePx + delta)),
      });
    },
    [session.fontSizePx, updateSession]
  );

  const handleExit = useCallback(() => {
    pause();
    void saveBookmarkNow();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setScreen('preview');
  }, [pause, saveBookmarkNow, setScreen]);

  // ---------- Manual scroll: wheel ----------
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (playingRef.current) pause();
      offsetRef.current = clampOffset(offsetRef.current + e.deltaY);
      applyOffset();
      updateCurrentPage();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [pause, clampOffset, applyOffset, updateCurrentPage]);

  // ---------- Manual scroll: pointer (drag / touch) ----------
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const onPointerDown = (e: PointerEvent) => {
      pointerStateRef.current = { down: true, startY: e.clientY, lastY: e.clientY, moved: false };
    };

    const onPointerMove = (e: PointerEvent) => {
      const s = pointerStateRef.current;
      if (!s.down) return;
      const dy = s.lastY - e.clientY;
      if (!s.moved && Math.abs(e.clientY - s.startY) > 5) {
        s.moved = true;
        if (playingRef.current) pause();
      }
      if (s.moved) {
        offsetRef.current = clampOffset(offsetRef.current + dy);
        applyOffset();
        s.lastY = e.clientY;
        updateCurrentPage();
      }
    };

    const onPointerUp = () => {
      const s = pointerStateRef.current;
      if (!s.down) return;
      s.down = false;
      if (!s.moved) togglePlay();
    };

    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [pause, clampOffset, applyOffset, togglePlay, updateCurrentPage]);

  // ---------- Keyboard shortcuts ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowUp':
          e.preventDefault();
          bumpSpeed(5);
          break;
        case 'ArrowDown':
          e.preventDefault();
          bumpSpeed(-5);
          break;
        case 'PageDown':
          e.preventDefault();
          if (playingRef.current) pause();
          offsetRef.current = clampOffset(offsetRef.current + window.innerHeight * 0.85);
          applyOffset();
          updateCurrentPage();
          break;
        case 'PageUp':
          e.preventDefault();
          if (playingRef.current) pause();
          offsetRef.current = clampOffset(offsetRef.current - window.innerHeight * 0.85);
          applyOffset();
          updateCurrentPage();
          break;
        case 'Home':
          e.preventDefault();
          if (playingRef.current) pause();
          offsetRef.current = 0;
          applyOffset();
          updateCurrentPage();
          break;
        case 'End':
          e.preventDefault();
          if (playingRef.current) pause();
          offsetRef.current = clampOffset(Number.MAX_SAFE_INTEGER);
          applyOffset();
          updateCurrentPage();
          break;
        case 'f': case 'F': toggleFullscreen(); break;
        case 'm': case 'M': updateSession({ mirror: !session.mirror }); break;
        case 'c': case 'C': setShowControls((v) => !v); break;
        case 'r': case 'R': restart(); break;
        case '+': case '=': bumpFont(4); break;
        case '-': case '_': bumpFont(-4); break;
        case 'Escape': if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, bumpSpeed, bumpFont, updateSession, session.mirror, restart, toggleFullscreen, clampOffset, applyOffset, pause, updateCurrentPage]);

  // ---------- Restore bookmark on mount ----------
  useEffect(() => {
    if (!docId) return;
    const bookmark = useAppStore.getState().doc?.bookmark;
    
    if (bookmark) {
      setCurrentPage(bookmark.pageNumber);
    } else {
      setCurrentPage(includedPages[0] || 1);
    }

    if (!bookmark) return;

    const restore = () => {
      if (!scrollContainerRef.current || !contentRef.current) return;
      const newOffset = restoreBookmarkOffset(
        scrollContainerRef.current,
        contentRef.current,
        bookmark,
        READING_Y
      );
      offsetRef.current = clampOffset(newOffset);
      applyOffset();
    };

    const raf = requestAnimationFrame(restore);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(restore).catch(() => {});
    }
    return () => cancelAnimationFrame(raf);
  }, [docId, clampOffset, applyOffset, includedPages]);

  // ---------- Auto-save bookmark while playing ----------
  useEffect(() => {
    if (!playing) return;
    const interval = window.setInterval(() => void saveBookmarkNow(), 5000);
    return () => window.clearInterval(interval);
  }, [playing, saveBookmarkNow]);

  // ---------- Save on tab hide ----------
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') void saveBookmarkNow();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [saveBookmarkNow]);

  // ---------- Mount / unmount ----------
  useEffect(() => {
    offsetRef.current = 0;
    applyOffset();
    scheduleHideControls();
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      playingRef.current = false;
    };
  }, [applyOffset, scheduleHideControls]);

  const themeVars = useMemo(() => {
    switch (session.theme) {
      case 'black-on-white': return { '--tp-bg': '#ffffff', '--tp-text': '#0a0a0a' };
      case 'yellow-on-black': return { '--tp-bg': '#000000', '--tp-text': '#ffd34d' };
      default: return { '--tp-bg': '#000000', '--tp-text': '#ffffff' };
    }
  }, [session.theme]);

  if (!doc) return null;

  return (
    <div
      className="teleprompter"
      style={themeVars as React.CSSProperties}
      onMouseMove={() => {
        setShowControls(true);
        scheduleHideControls();
      }}
    >
      {session.guideVisible && (
        <div
          className="reading-guide"
          style={{ top: `${session.guidePositionPct}%` }}
        />
      )}

      <div ref={scrollContainerRef} className="scroll-container">
        <div ref={contentRef} className="scroll-translate">
          <div
            className={`content ${session.mirror ? 'mirrored' : ''} col-${session.columnWidth}`}
            style={{ fontSize: `${session.fontSizePx}px` }}
          >
            <div className="content-spacer" aria-hidden="true" />
            {promptBlocks.map((b) =>
              b.type === 'heading' ? (
                <h2
                  key={b.id}
                  className="prompt-heading"
                  data-block-id={b.id}
                  data-page-number={b.pageNumber}
                >
                  {b.text}
                </h2>
              ) : (
                <p
                  key={b.id}
                  className="prompt-para"
                  data-block-id={b.id}
                  data-page-number={b.pageNumber}
                >
                  {b.text}
                </p>
              )
            )}
            <div className="content-spacer-end" aria-hidden="true" />
          </div>
        </div>
      </div>

      {showControls && (
        <ControlsOverlay
          playing={playing}
          speed={session.speedPxPerSec}
          fontSize={session.fontSizePx}
          currentPage={currentPage}
          totalPages={maxPageNumber}
          theme={session.theme}
          mirror={session.mirror}
          columnWidth={session.columnWidth}
          guideVisible={session.guideVisible}
          onTogglePlay={togglePlay}
          onSpeedChange={(v) => updateSession({ speedPxPerSec: v })}
          onFontChange={(v) => updateSession({ fontSizePx: v })}
          onPageChange={jumpToPage}
          onThemeChange={(t) => updateSession({ theme: t })}
          onToggleMirror={() => updateSession({ mirror: !session.mirror })}
          onToggleColumnWidth={() =>
            updateSession({
              columnWidth: session.columnWidth === 'narrow' ? 'wide' : 'narrow',
            })
          }
          onToggleGuide={() =>
            updateSession({ guideVisible: !session.guideVisible })
          }
          onRestart={restart}
          onExit={handleExit}
        />
      )}
    </div>
  );
}