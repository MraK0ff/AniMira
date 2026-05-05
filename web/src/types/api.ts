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
