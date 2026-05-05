import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AnimeItem } from '../types/api';

interface WatchHistoryEntry extends AnimeItem {
  lastWatchedAt: number;
  lastEpisodeUrl?: string;
  lastEpisodeTitle?: string;
  progress?: number; // seconds
}

interface AppState {
  currentSource: string;
  setSource: (source: string) => void;
  
  favorites: AnimeItem[];
  toggleFavorite: (anime: AnimeItem) => void;
  isFavorite: (url: string) => boolean;

  history: WatchHistoryEntry[];
  addToHistory: (anime: AnimeItem, episode?: {url: string, title: string}, progress?: number) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentSource: 'anilibria', // default
      setSource: (source) => set({ currentSource: source }),

      favorites: [],
      toggleFavorite: (anime) => set((state) => {
        const exists = state.favorites.some(f => f.url === anime.url);
        if (exists) {
          return { favorites: state.favorites.filter(f => f.url !== anime.url) };
        }
        return { favorites: [...state.favorites, anime] };
      }),
      isFavorite: (url) => get().favorites.some(f => f.url === url),

      history: [],
      addToHistory: (anime, episode, progress) => set((state) => {
        const existing = state.history.filter(h => h.url !== anime.url);
        const newEntry: WatchHistoryEntry = {
          ...anime,
          lastWatchedAt: Date.now(),
          lastEpisodeUrl: episode?.url,
          lastEpisodeTitle: episode?.title,
          progress
        };
        return { history: [newEntry, ...existing].slice(0, 100) }; // Keep last 100
      }),
    }),
    {
      name: 'anilabx-web-storage',
    }
  )
);
