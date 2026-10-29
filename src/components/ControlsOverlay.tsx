import type { ThemeName } from '../types';

interface Props {
  playing: boolean;
  speed: number;
  fontSize: number;
  currentPage: number;
  totalPages: number;
  theme: ThemeName;
  mirror: boolean;
  columnWidth: 'narrow' | 'wide';
  guideVisible: boolean;
  onTogglePlay: () => void;
  onSpeedChange: (v: number) => void;
  onFontChange: (v: number) => void;
  onPageChange: (v: number) => void;
  onThemeChange: (t: ThemeName) => void;
  onToggleMirror: () => void;
  onToggleColumnWidth: () => void;
  onToggleGuide: () => void;
  onRestart: () => void;
  onExit: () => void;
}

export function ControlsOverlay(props: Props) {
  const {
    playing,
    speed,
    fontSize,
    currentPage,
    totalPages,
    theme,
    mirror,
    columnWidth,
    guideVisible,
    onTogglePlay,
    onSpeedChange,
    onFontChange,
    onPageChange,
    onThemeChange,
    onToggleMirror,
    onToggleColumnWidth,
    onToggleGuide,
    onRestart,
    onExit,
  } = props;

  return (
    <div className="controls" onClick={(e) => e.stopPropagation()}>
      <div className="controls-row">
        <button
          className="ctrl-btn big"
          onClick={onTogglePlay}
          title="Play / pause (Space)"
        >
          {playing ? '⏸' : '▶'}
        </button>

        <div className="ctrl-group">
          <label>Speed</label>
          <input
            type="range"
            min={5}
            max={300}
            value={speed}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
          />
          <span className="ctrl-value">{speed}</span>
        </div>

        <div className="ctrl-group">
          <label>Size</label>
          <input
            type="range"
            min={24}
            max={140}
            value={fontSize}
            onChange={(e) => onFontChange(Number(e.target.value))}
          />
          <span className="ctrl-value">{fontSize}</span>
        </div>

        {/* NEW: Page Selector */}
        <div className="ctrl-group">
          <label>Page</label>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={currentPage || 1}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (val >= 1 && val <= totalPages) onPageChange(val);
            }}
            className="ctrl-page-input"
          />
          <span style={{ color: '#666' }}>/ {totalPages}</span>
        </div>

        <div className="ctrl-group">
          <label>Theme</label>
          <select
            value={theme}
            onChange={(e) => onThemeChange(e.target.value as ThemeName)}
          >
            <option value="white-on-black">White on black</option>
            <option value="black-on-white">Black on white</option>
            <option value="yellow-on-black">Yellow on black</option>
          </select>
        </div>

        <button
          className={`ctrl-btn ${mirror ? 'active' : ''}`}
          onClick={onToggleMirror}
          title="Mirror (M)"
        >
          Mirror
        </button>

        <button
          className="ctrl-btn"
          onClick={onToggleColumnWidth}
          title="Toggle column width"
        >
          {columnWidth === 'narrow' ? 'Narrow' : 'Wide'}
        </button>

        <button
          className={`ctrl-btn ${guideVisible ? 'active' : ''}`}
          onClick={onToggleGuide}
          title="Reading guide"
        >
          Guide
        </button>

        <button className="ctrl-btn" onClick={onRestart} title="Restart (R)">
          Restart
        </button>

        <button className="ctrl-btn ghost" onClick={onExit}>
          Exit
        </button>
      </div>

      <div className="controls-hint">
        Space: play/pause · ↑↓: speed · F: fullscreen · M: mirror · C: hide
        controls · R: restart · +/−: font size
      </div>
    </div>
  );
}