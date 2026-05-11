/// <reference types="vite/client" />
import axios from 'axios';
import { 
  Source, 
  AnimeListResponse, 
  AnimeDetails, 
  EpisodesResponse, 
  VideoInfo,
  AnimeItem,
  AggregatedSearchResponse,
  AggregatedAnimeDetails
} from '../types/api';

// API URL: используем относительный путь для единого домена
const API_BASE_URL = (import.meta.env.VITE_API_URL || '') + '/api';

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
  return response.data;
};

export interface SearchResponse {
  source: string;
  query: string;
  page: number;
  items: AnimeItem[];
  count: number;
}

export const searchAnime = async (source: string, query: string, page = 1): Promise<SearchResponse> => {
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

export interface ScheduleItem {
  title: string;
  url: string;
  cover: string | null;
  time_left: string | null;
}

export interface ScheduleResponse {
  source: string;
  schedule: ScheduleItem[];
}

export const getAnimeSchedule = async (source: string): Promise<ScheduleResponse> => {
  const { data } = await api.get('/anime/schedule', {
    params: { source }
  });
  return data;
};

// Aggregated API (Shikimori integration)
export const aggregatedSearch = async (query: string): Promise<AggregatedSearchResponse> => {
  const { data } = await api.get('/aggregated/search', {
    params: { query }
  });
  return data;
};

export const getAggregatedDetails = async (shikimoriId: number): Promise<AggregatedAnimeDetails> => {
  const { data } = await api.get(`/aggregated/details/${shikimoriId}`);
  return data;
};
