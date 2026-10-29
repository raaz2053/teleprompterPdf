import { create } from 'zustand';
import type { AppScreen, PromptSession, ScriptDocument } from '../types';
import { updateBookmark } from '../lib/library';

interface AppState {
  screen: AppScreen;
  doc: ScriptDocument | null;
  session: PromptSession;
  setScreen: (s: AppScreen) => void;
  setDoc: (d: ScriptDocument | null) => void;
  togglePage: (pageNumber: number) => void;
  updateSession: (p: Partial<PromptSession>) => void;
  resetSession: () => void;
  reset: () => void;
  clearBookmark: () => Promise<void>;
  setBookmark: (bookmark: ScriptDocument['bookmark']) => void;
}

const defaultSession: PromptSession = {
  offsetPx: 0,
  speedPxPerSec: 60,
  isPlaying: false,
  mirror: false,
  theme: 'white-on-black',
  fontSizePx: 56,
  columnWidth: 'narrow',
  guideVisible: false,
  guidePositionPct: 25,
};

export const useAppStore = create<AppState>((set, get) => ({
  screen: 'intake',
  doc: null,
  session: { ...defaultSession },
  setScreen: (s) => set({ screen: s }),
  setDoc: (d) => set({ doc: d }),
  togglePage: (pageNumber) =>
    set((state) => {
      if (!state.doc) return {};
      const pages = state.doc.pages.map((p) =>
        p.pageNumber === pageNumber ? { ...p, isIncluded: !p.isIncluded } : p
      );
      return { doc: { ...state.doc, pages } };
    }),
  updateSession: (p) => set((s) => ({ session: { ...s.session, ...p } })),
  resetSession: () => set({ session: { ...defaultSession } }),
  reset: () =>
    set({ screen: 'intake', doc: null, session: { ...defaultSession } }),
  clearBookmark: async () => {
    const { doc } = get();
    if (!doc) return;
    await updateBookmark(doc.id, null);
    set({ doc: { ...doc, bookmark: null } });
  },
  setBookmark: (bookmark) => {
    const { doc } = get();
    if (!doc) return;
    set({ doc: { ...doc, bookmark } });
  },
}));