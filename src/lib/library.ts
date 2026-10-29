import type { Bookmark, ScriptDocument } from '../types';

const DB_NAME = 'cuepdf-db';
const DB_VERSION = 1;
const STORE = 'documents';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function saveDocument(doc: ScriptDocument): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(doc);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getDocument(id: string): Promise<ScriptDocument | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as ScriptDocument | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllDocuments(): Promise<ScriptDocument[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const docs = (req.result as ScriptDocument[]) ?? [];
      docs.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
      resolve(docs);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function findByHash(hash: string): Promise<ScriptDocument | null> {
  const all = await getAllDocuments();
  return all.find((d) => d.fileHash === hash) ?? null;
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateBookmark(
  id: string,
  bookmark: Bookmark | null
): Promise<void> {
  const doc = await getDocument(id);
  if (!doc) return;
  doc.bookmark = bookmark;
  await saveDocument(doc);
}

export async function touchLastOpened(id: string): Promise<ScriptDocument | null> {
  const doc = await getDocument(id);
  if (!doc) return null;
  doc.lastOpenedAt = Date.now();
  await saveDocument(doc);
  return doc;
}

export async function hashFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function summarizeDocument(doc: ScriptDocument) {
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
  return {
    words,
    chars,
    includedPages: included,
    totalPages: doc.pages.length,
  };
}