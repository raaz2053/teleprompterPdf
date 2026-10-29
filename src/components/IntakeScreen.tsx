import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store';
import { extractPdf } from '../lib/pdf-extract';
import { buildDocumentFromText, buildPages } from '../lib/reconstruct';
import { runOcr } from '../lib/ocr';
import {
  deleteDocument,
  findByHash,
  getAllDocuments,
  hashFile,
  saveDocument,
  summarizeDocument,
  touchLastOpened,
} from '../lib/library';
import type { ScriptDocument } from '../types';

const genId = () => Math.random().toString(36).slice(2, 10);

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return d.toLocaleDateString();
}

export function IntakeScreen() {
  const setDoc = useAppStore((s) => s.setDoc);
  const setScreen = useAppStore((s) => s.setScreen);

  const [docs, setDocs] = useState<ScriptDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [stripHeaders, setStripHeaders] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const all = await getAllDocuments();
    setDocs(all);
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const openDoc = useCallback(
    async (doc: ScriptDocument) => {
      const fresh = await touchLastOpened(doc.id);
      setDoc(fresh ?? doc);
      setScreen('preview');
    },
    [setDoc, setScreen]
  );

  const handlePdfFile = useCallback(
    async (file: File) => {
      setStatus('Checking library…');
      try {
        const hash = await hashFile(file);
        const existing = await findByHash(hash);
        if (existing) {
          setStatus('Already in your library — opening…');
          await openDoc(existing);
          return;
        }

        setStatus('Reading PDF…');
        const extracted = await extractPdf(file, (p, total) => {
          setStatus(`Parsing page ${p} of ${total}…`);
        });

        let rawLines = extracted.rawLinesPerPage;

        if (extracted.likelyScanned) {
          const proceed = window.confirm(
            `This PDF appears to be scanned (~${Math.round(
              extracted.avgCharsPerPage
            )} characters per page). Run OCR? This can take a while.`
          );
          if (!proceed) {
            setStatus('OCR cancelled. Try a text-based PDF instead.');
            return;
          }
          setStatus('Running OCR…');
          rawLines = await runOcr(file, (p, total, st) => {
            setStatus(`OCR page ${p}/${total}: ${st}`);
          });
        }

        const pages = buildPages(rawLines, { stripHeaders });
        const totalChars = pages.reduce((n, p) => n + p.rawText.length, 0);
        if (totalChars < 20) {
          setStatus('No readable text found in this PDF.');
          return;
        }

        const now = Date.now();
        const doc: ScriptDocument = {
          id: genId(),
          title: file.name.replace(/\.pdf$/i, ''),
          source: 'pdf',
          pages,
          createdAt: now,
          lastOpenedAt: now,
          fileHash: hash,
          fileSize: file.size,
          bookmark: null,
        };

        await saveDocument(doc);
        await refresh();
        setDoc(doc);
        setScreen('preview');
      } catch (err) {
        console.error(err);
        setStatus(`Error: ${(err as Error).message}`);
      }
    },
    [openDoc, refresh, setDoc, setScreen, stripHeaders]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type === 'application/pdf' || file.name.endsWith('.pdf'))) {
      handlePdfFile(file);
    } else if (file) {
      setStatus('Please drop a PDF file.');
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handlePdfFile(file);
    e.target.value = '';
  };

  const handlePaste = async () => {
    if (!pasteText.trim()) return;
    const pages = buildDocumentFromText(pasteText);
    const now = Date.now();
    const doc: ScriptDocument = {
      id: genId(),
      title: `Pasted script — ${new Date(now).toLocaleDateString()}`,
      source: 'paste',
      pages,
      createdAt: now,
      lastOpenedAt: now,
      bookmark: null,
    };
    await saveDocument(doc);
    await refresh();
    setDoc(doc);
    setScreen('preview');
  };

  const handleDelete = async (doc: ScriptDocument) => {
    if (!window.confirm(`Delete "${doc.title}" from your library?`)) return;
    await deleteDocument(doc.id);
    await refresh();
  };

  return (
    <div className="intake">
      <header>
        <h1>CuePDF</h1>
        <p className="tagline">
          Teleprompter that reads your PDFs — in your browser.
        </p>
      </header>

      <section
        className={`dropzone ${isDragging ? 'dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          accept="application/pdf,.pdf"
          ref={fileInputRef}
          onChange={onFileChange}
          hidden
        />
        <div className="dropzone-inner">
          <span className="drop-icon">📄</span>
          <h2>Drop a PDF here</h2>
          <p>
            or click to browse. Parsed entirely in your browser — nothing uploaded.
          </p>
        </div>
      </section>

      <label className="strip-toggle">
        <input
          type="checkbox"
          checked={stripHeaders}
          onChange={(e) => setStripHeaders(e.target.checked)}
        />
        Remove repeated headers &amp; footers
      </label>

      {status && <div className="status">{status}</div>}

      <div className="divider">
        <span>or paste a script</span>
      </div>

      <section className="paste-section">
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="Paste your script here…"
          rows={4}
        />
        <button
          className="primary"
          onClick={handlePaste}
          disabled={!pasteText.trim()}
        >
          Use pasted script
        </button>
      </section>

      <section className="library">
        <h3 className="library-heading">
          Your library {docs.length > 0 && <span>({docs.length})</span>}
        </h3>

        {loading ? (
          <p className="library-empty">Loading…</p>
        ) : docs.length === 0 ? (
          <p className="library-empty">
            No documents yet. Upload a PDF or paste a script to get started.
          </p>
        ) : (
          <ul className="library-list">
            {docs.map((doc) => {
              const stats = summarizeDocument(doc);
              const bm = doc.bookmark;
              const progress = bm && stats.totalPages > 0
                ? Math.round(((bm.pageNumber - 1) / stats.totalPages) * 100)
                : 0;
              return (
                <li key={doc.id} className="library-item">
                  <button
                    className="library-item-main"
                    onClick={() => openDoc(doc)}
                  >
                    <div className="library-item-title">{doc.title}</div>
                    <div className="library-item-meta">
                      <span>{stats.includedPages}p</span>
                      <span>·</span>
                      <span>{stats.words.toLocaleString()} words</span>
                      <span>·</span>
                      <span>{formatDate(doc.lastOpenedAt)}</span>
                      {doc.source === 'paste' && (
                        <>
                          <span>·</span>
                          <span className="badge">pasted</span>
                        </>
                      )}
                    </div>
                    {bm && (
                      <div className="library-item-bookmark">
                        📖 Resume from page {bm.pageNumber}
                        {progress > 0 && <span> ({progress}%)</span>}
                      </div>
                    )}
                  </button>
                  <button
                    className="library-item-delete"
                    onClick={() => handleDelete(doc)}
                    title="Delete"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}