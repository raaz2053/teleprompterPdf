# CuePDF — Teleprompter with PDF Ingestion

A browser-only teleprompter that reads your PDFs. Text extraction and OCR happen
entirely client-side; nothing is uploaded to a server.

## Features

- **Book library** — every PDF you upload is parsed once and stored in IndexedDB.
  Reopening the app restores your whole library instantly.
- **Deduplication** — SHA-256 hashing means dropping the same PDF twice loads the
  existing entry instead of re-parsing.
- **Bookmarks** — CuePDF remembers where you stopped reading (auto-saved every
  5 s while playing, on pause, and on exit). Resume in one click.
- **Manual scroll** — scroll with the mouse wheel, drag with the pointer, or use
  PageUp/PageDown/Home/End while playing or paused. Manual input pauses playback
  cleanly.
- **PDF upload** — drag-and-drop or file picker. Uses PDF.js to reconstruct text.
- **Repeated header/footer stripping** — automatically detects repeating lines
  across pages.
- **OCR fallback** — for scanned image PDFs, offers a Tesseract.js OCR pass.
- **Text paste fallback** — for parity with CuePrompter-style workflows.
- **Teleprompter** — smooth `requestAnimationFrame` scroll, live speed, mirror,
  three themes, adjustable font size, narrow/wide column, reading guide.
- **Keyboard shortcuts** — Space, ↑↓, F, M, C, R, +/−, PageUp/PageDown, Home/End.

## Install & run

```bash
npm install
npm run dev