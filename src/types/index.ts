export type SourceType = 'pdf' | 'paste';

export interface ScriptBlock {
  id: string;
  type: 'paragraph' | 'heading';
  text: string;
  pageNumber?: number;
}

export interface ScriptPage {
  pageNumber: number;
  blocks: ScriptBlock[];
  rawText: string;
  isIncluded: boolean;
}

export interface Bookmark {
  blockId: string;
  blockProgress: number; // 0..1 position within the block
  pageNumber: number;
  savedAt: number;
}

export interface ScriptDocument {
  id: string;
  title: string;
  source: SourceType;
  pages: ScriptPage[];
  createdAt: number;
  lastOpenedAt: number;
  /** SHA-256 of the original file; used to avoid re-parsing the same PDF. */
  fileHash?: string;
  /** Original file size in bytes (informational). */
  fileSize?: number;
  bookmark?: Bookmark | null;
}

export type ThemeName = 'white-on-black' | 'black-on-white' | 'yellow-on-black';

export interface PromptSession {
  offsetPx: number;
  speedPxPerSec: number;
  isPlaying: boolean;
  mirror: boolean;
  theme: ThemeName;
  fontSizePx: number;
  columnWidth: 'narrow' | 'wide';
  guideVisible: boolean;
  guidePositionPct: number;
}

export type AppScreen = 'intake' | 'preview' | 'prompter';