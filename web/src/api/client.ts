/// <reference types="vite/client" />
import axios from 'axios';
import { 
  Source, 
  AnimeListResponse, 
  AnimeDetails, 
  EpisodesResponse, 
  VideoInfo,
  AnimeItem
} from '../types/api';

// API URL: используем относительный путь для единого домена
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

export const getSources = async (): Promise<Source[]> => {
  const { data } = await api.get('/sources');
  return data;
};

export const getAnimeList = async (source: string, page = 1, category?: string): Promise<AnimeListResponse> => {
  const response = await api.get('/anime/list', {
    params: { source, page, category }
  });
  console.log('[API] getAnimeList raw response:', response);
  console.log('[API] getAnimeList data:', response.data);
  console.log('[API] items type:', typeof response.data?.items, 'isArray:', Array.isArray(response.data?.items));
  return response.data;
};

export const searchAnime = async (source: string, query: string, page = 1): Promise<{items: AnimeItem[]}> => {
  const { data } = await api.get('/anime/search', {
    params: { source, query, page }
  });
  return data;
};

export const getAnimeDetails = async (source: string, url: string): Promise<AnimeDetails> => {
  const { data } = await api.get('/anime/details', {
    params: { source, url }
  });
  return data;
};

export const getAnimeEpisodes = async (source: string, url: string): Promise<EpisodesResponse> => {
  const { data } = await api.get('/anime/episodes', {
    params: { source, url }
  });
  return data;
};

export const getVideoInfo = async (source: string, episode_url: string): Promise<VideoInfo> => {
  const { data } = await api.get('/anime/video', {
    params: { source, episode_url }
  });
  return data;
};

export interface TorrentInfo {
  torrent_url: string;
  filename: string | null;
  quality: string | null;
  error?: string;
}

export const getTorrentInfo = async (torrent_url: string): Promise<TorrentInfo> => {
  const { data } = await api.get('/anime/torrent/info', {
    params: { torrent_url }
  });
  return data;
};
