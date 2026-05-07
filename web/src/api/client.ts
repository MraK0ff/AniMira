import axios from 'axios';
import { 
  Source, 
  AnimeListResponse, 
  AnimeDetails, 
  EpisodesResponse, 
  VideoInfo,
  AnimeItem
} from '../types/api';

const api = axios.create({
  baseURL: 'https://animira-api.onrender.com',
});

export const getSources = async (): Promise<Source[]> => {
  const { data } = await api.get('/sources');
  return data;
};

export const getAnimeList = async (source: string, page = 1, category?: string): Promise<AnimeListResponse> => {
  const { data } = await api.get('/anime/list', {
    params: { source, page, category }
  });
  return data;
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
