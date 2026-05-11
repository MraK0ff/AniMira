export interface Source {
  name: string;
  title: string;
  host: string;
  language: string;
  content_type: string;
  icon_link?: string;
}

export interface AnimeItem {
  title: string;
  additional_title?: string;
  url: string;
  cover?: string;
  episodes_aired?: string;
  next_episode_at?: string;
  season?: string;
  uniq?: string;
  source?: string; // For aggregated/unmatched results
}

export interface AnimeListResponse {
  source: string;
  page: number;
  category?: string;
  categories: {tag: string; name: string}[];
  items: AnimeItem[];
  count: number;
  has_next: boolean;
}

export interface AnimeDetails {
  source: string;
  title: string;
  additional_title?: string;
  alt_title?: string;
  url: string;
  cover?: string;
  summary?: string;
  production_year?: string;
  episodes?: string;
  ep_length?: string;
  status?: string;
  content_type?: string;
  country?: string;
  author?: string;
  genres: string[];
  dubbers: string[];
  producers: string[];
  related?: string;
  is_have_subs: boolean;
  uniq?: string;
  torrents?: Torrent[];
}

export interface Torrent {
  title: string;
  url: string;
  size?: string;
  seeders?: string;
  leechers?: string;
  downloads?: string;
  date?: string;
}

export interface EpisodeLink {
  name: string;
  url: string;
}

export interface Episode {
  title: string;
  url: string;
  uniq?: string;
  direct_links: boolean;
  url360?: string;
  url720?: string;
  links: EpisodeLink[];
  service?: string;
}

export interface EpisodesResponse {
  source: string;
  anime_url: string;
  episodes_from_page?: string;
  episodes: Episode[];
}

export interface VideoInfo {
  source: string;
  url: string;
  headers: Record<string, string>;
  referer?: string;
  direct: boolean;
}

// Shikimori types
export interface ShikimoriAnime {
  id: number;
  url: string;
  name: string;
  russian: string;
  english: string;
  japanese: string;
  kind: string;
  rating: string;
  score: number | string | null;
  status: string;
  episodes: number;
  episodesAired: number;
  duration: number;
  season: string;
  poster?: {
    originalUrl: string;
    mainUrl: string;
  };
  genres?: Array<{
    id: number;
    name: string;
    russian: string;
  }>;
  studios?: Array<{
    id: number;
    name: string;
  }>;
  description?: string;
}

export interface AggregatedSource {
  source: string;
  url: string;
  title: string;
  additional_title?: string;
  dubbers: string[];
  episodes_count: number;
}

export interface AggregatedEpisode extends Episode {
  source: string;
  anime_url: string;
  dubbers: string[];
  source_title: string;
}

export interface AggregatedAnimeDetails {
  shikimori_id: number;
  shikimori: ShikimoriAnime;
  sources: AggregatedSource[];
  episodes_by_dubber: Record<string, AggregatedEpisode[]>;
  total_episodes: number;
  dubber_count: number;
}

export interface AggregatedSearchResult {
  shikimori_id: number;
  shikimori: ShikimoriAnime;
  similarity: number;
  sources: Array<{
    source: string;
    title: string;
    url: string;
    cover?: string;
    episodes_aired?: string;
  }>;
  source_count: number;
}

export interface AggregatedSearchResponse {
  query: string;
  shikimori_matches: number;
  unmatched_count: number;
  results: AggregatedSearchResult[];
  unmatched: AnimeItem[];
}
