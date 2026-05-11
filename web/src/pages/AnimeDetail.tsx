import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  getAnimeDetails, 
  getAnimeEpisodes, 
  getTorrentInfo, 
  type TorrentInfo,
  getAggregatedDetails,
  aggregatedSearch
} from '../api/client';
import { 
  Play, Heart, Share2, Info, List, Clock, Calendar, Star, 
  ExternalLink, Download, HardDrive, ArrowUpCircle, ArrowDownCircle, 
  ChevronDown, Volume2, Globe, Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import clsx from 'clsx';
import { useState, useMemo } from 'react';
import type { AggregatedAnimeDetails, AggregatedEpisode } from '../types/api';

function extractQuality(title: string): string | null {
  const patterns = [/(\d{3,4}p)/i, /(4K|UHD)/i, /(FHD|FullHD)/i, /(HD|SD)/i];
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) return match[1].toUpperCase();
  }
  return null;
}

function extractEpisodeNumber(title: string): number | null {
  const patterns = [
    /[-\s]\s*(\d+)\s*\[/, /\s(\d{2,3})\s*\[/, /серия\s*(\d+)/i,
    /episode\s*(\d+)/i, /ep\s*(\d+)/i, /\s(\d+)\s*\.\s*(mp4|mkv|avi)/i,
    /\[(\d{2,3})\]/, /^(\d+)$/
  ];
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > 0 && num < 1000) return num;
    }
  }
  return null;
}

export default function AnimeDetail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const source = searchParams.get('source');
  const url = searchParams.get('url');
  const shikimoriId = searchParams.get('shikimori_id');

  const { isFavorite, toggleFavorite } = useStore();
  const [selectedDubber, setSelectedDubber] = useState<string>('');
  const [selectedQuality, setSelectedQuality] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'episodes' | 'torrents'>('episodes');
  const [torrentMeta, setTorrentMeta] = useState<Record<string, TorrentInfo>>({});
  const [showDubberSelect, setShowDubberSelect] = useState(false);

  // Legacy mode - single source
  const { data: details, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['animeDetails', source, url],
    queryFn: () => getAnimeDetails(source!, url!),
    enabled: !!source && !!url && !shikimoriId
  });

  const { data: epData, isLoading: isEpLoading } = useQuery({
    queryKey: ['animeEpisodes', source, url],
    queryFn: () => getAnimeEpisodes(source!, url!),
    enabled: !!source && !!url && !shikimoriId
  });

  // Aggregated mode - Shikimori
  const { data: aggregatedData, isLoading: isLoadingAggregated } = useQuery({
    queryKey: ['aggregatedDetails', shikimoriId],
    queryFn: () => getAggregatedDetails(parseInt(shikimoriId!)),
    enabled: !!shikimoriId
  });

  // Set default dubber when aggregated data loads
  useMemo(() => {
    if (aggregatedData && !selectedDubber) {
      const dubbers = Object.keys(aggregatedData.episodes_by_dubber);
      if (dubbers.length > 0) {
        setSelectedDubber(dubbers[0]);
      }
    }
  }, [aggregatedData, selectedDubber]);

  const isLoading = isLoadingDetails || isLoadingAggregated;
  const isAggregatedMode = !!shikimoriId && !!aggregatedData;

  // Get episodes for selected dubber
  const currentEpisodes = useMemo(() => {
    if (isAggregatedMode && aggregatedData) {
      return aggregatedData.episodes_by_dubber[selectedDubber] || [];
    }
    return epData?.episodes || [];
  }, [isAggregatedMode, aggregatedData, selectedDubber, epData]);

  // Get all available dubbers
  const availableDubbers = useMemo(() => {
    if (isAggregatedMode && aggregatedData) {
      return Object.keys(aggregatedData.episodes_by_dubber);
    }
    return details?.dubbers || [];
  }, [isAggregatedMode, aggregatedData, details]);

  const fetchTorrentMeta = async (torrents: Array<{url: string; title: string}> | undefined) => {
    if (!torrents) return;
    for (const torrent of torrents) {
      if (!torrentMeta[torrent.url]) {
        try {
          const info = await getTorrentInfo(torrent.url);
          setTorrentMeta(prev => ({ ...prev, [torrent.url]: info }));
        } catch {
          // ignore
        }
      }
    }
  };

  if (details?.torrents && Object.keys(torrentMeta).length === 0) {
    fetchTorrentMeta(details.torrents);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Determine display data
  const displayTitle = isAggregatedMode 
    ? aggregatedData?.shikimori?.russian || aggregatedData?.shikimori?.name
    : details?.title;
  const displayAltTitle = isAggregatedMode
    ? aggregatedData?.shikimori?.name
    : details?.additional_title;
  const displayCover = isAggregatedMode
    ? aggregatedData?.shikimori?.poster?.originalUrl
    : details?.cover;
  const displayDescription = isAggregatedMode
    ? aggregatedData?.shikimori?.description
    : details?.summary;
  const displayGenres = isAggregatedMode
    ? aggregatedData?.shikimori?.genres?.map(g => g.russian || g.name) || []
    : details?.genres || [];
  const displayStatus = isAggregatedMode
    ? aggregatedData?.shikimori?.status
    : details?.status;
  const displayEpisodes = isAggregatedMode
    ? `${aggregatedData?.shikimori?.episodesAired || 0} / ${aggregatedData?.shikimori?.episodes || 0}`
    : details?.episodes;
  const displayScore = isAggregatedMode
    ? aggregatedData?.shikimori?.score
    : null;

  const isFav = isFavorite(details?.url || url || '');

  // Handle episode click for aggregated mode
  const handleEpisodeClick = (episode: AggregatedEpisode | any) => {
    if (isAggregatedMode) {
      // In aggregated mode, pass all dubbers for this episode
      const epNum = extractEpisodeNumber(episode.uniq || episode.title || '');
      const allVersions = aggregatedData?.episodes_by_dubber 
        ? Object.entries(aggregatedData.episodes_by_dubber).flatMap(([dubber, eps]) => {
            const found = eps.find(e => {
              const num = extractEpisodeNumber(e.uniq || e.title || '');
              return num === epNum;
            });
            return found ? [{ ...found, dubber }] : [];
          })
        : [];
      
      navigate(`/player?shikimori_id=${shikimoriId}&episode=${encodeURIComponent(episode.uniq || episode.title || '')}`, {
        state: { 
          episode, 
          episodes: currentEpisodes,
          allDubbers: availableDubbers,
          selectedDubber,
          aggregatedData,
          allVersions
        }
      });
    } else {
      const videoUrl = episode.url720 || episode.url360 || episode.url;
      if (!videoUrl) return;
      navigate(`/player?source=${source}&episode_url=${encodeURIComponent(videoUrl)}`, { 
        state: { episode, episodes: epData?.episodes } 
      });
    }
  };

  return (
    <div className="min-h-screen pb-20">
      {/* Hero Banner */}
      <div className="relative h-[60vh] md:h-[70vh] w-full">
        <div className="absolute inset-0">
          <img 
            src={displayCover || 'https://via.placeholder.com/1920x1080?text=No+Cover'} 
            alt={displayTitle} 
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-base via-bg-base/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-bg-base via-bg-base/50 to-transparent" />
        </div>
        
        <div className="absolute bottom-0 left-0 px-6 md:px-12 pb-12 w-full max-w-6xl flex flex-col md:flex-row gap-8 items-end">
          <motion.img
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            src={displayCover}
            alt="Poster"
            className="hidden md:block w-48 md:w-64 rounded-xl shadow-2xl border border-white/10"
          />
          
          <div className="flex-1">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap gap-2 mb-3"
            >
              {displayGenres?.map((g: string) => (
                <span key={g} className="text-xs font-semibold px-2.5 py-1 bg-white/10 backdrop-blur-md rounded-full text-white capitalize">
                  {g}
                </span>
              ))}
              {displayStatus && (
                <span className="text-xs font-semibold px-2.5 py-1 bg-primary/20 text-primary border border-primary/30 rounded-full">
                  {displayStatus}
                </span>
              )}
              {displayScore && (
                <span className="text-xs font-semibold px-2.5 py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-full flex items-center gap-1">
                  <Star size={10} fill="currentColor" /> {displayScore}
                </span>
              )}
              {isAggregatedMode && (
                <span className="text-xs font-semibold px-2.5 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full flex items-center gap-1">
                  <Globe size={10} /> Shikimori
                </span>
              )}
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-6xl font-black text-white mb-2 shadow-black drop-shadow-2xl leading-tight"
            >
              {displayTitle}
            </motion.h1>
            
            {displayAltTitle && (
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-xl md:text-2xl text-text-muted font-medium mb-6"
              >
                {displayAltTitle}
              </motion.h2>
            )}

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap items-center gap-6 text-sm font-medium text-white mb-6"
            >
              {(isAggregatedMode ? aggregatedData?.shikimori?.season : details?.production_year) && (
                <div className="flex items-center gap-1.5">
                  <Calendar size={16} className="text-primary" /> 
                  {isAggregatedMode ? aggregatedData?.shikimori?.season : details?.production_year}
                </div>
              )}
              {displayEpisodes && (
                <div className="flex items-center gap-1.5">
                  <List size={16} className="text-primary" />
                  {displayEpisodes}
                </div>
              )}
              {(isAggregatedMode ? aggregatedData?.shikimori?.duration : details?.ep_length) && (
                <div className="flex items-center gap-1.5">
                  <Clock size={16} className="text-primary" /> 
                  {isAggregatedMode 
                    ? `${aggregatedData?.shikimori?.duration} мин` 
                    : details?.ep_length}
                </div>
              )}
              {isAggregatedMode && aggregatedData && (
                <div className="flex items-center gap-1.5">
                  <Layers size={16} className="text-primary" />
                  {aggregatedData.source_count || aggregatedData.sources?.length || 0} источников
                </div>
              )}
            </motion.div>

            {/* Dubber Selector for Aggregated Mode */}
            {isAggregatedMode && availableDubbers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="mb-4"
              >
                <div className="relative">
                  <button
                    onClick={() => setShowDubberSelect(!showDubberSelect)}
                    className="tv-focusable flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg px-4 py-2 transition-colors"
                  >
                    <Volume2 size={16} className="text-primary" />
                    <span className="text-white font-medium">
                      {selectedDubber || 'Выберите озвучку'}
                    </span>
                    <ChevronDown size={16} className={`text-text-muted transition-transform ${showDubberSelect ? 'rotate-180' : ''}`} />
                  </button>
                  
                  <AnimatePresence>
                    {showDubberSelect && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 mt-2 bg-bg-elevated border border-white/10 rounded-lg shadow-xl z-50 min-w-[200px]"
                      >
                        {availableDubbers.map((dubber) => (
                          <button
                            key={dubber}
                            onClick={() => {
                              setSelectedDubber(dubber);
                              setShowDubberSelect(false);
                            }}
                            className={clsx(
                              "w-full text-left px-4 py-2 hover:bg-white/5 transition-colors first:rounded-t-lg last:rounded-b-lg",
                              selectedDubber === dubber ? "text-primary font-medium bg-primary/10" : "text-white"
                            )}
                          >
                            {dubber}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex gap-4"
            >
              <button 
                className="tv-focusable bg-white text-black px-8 py-3.5 rounded-lg font-bold hover:bg-white/90 transition-colors flex items-center gap-2"
                onClick={() => {
                  const episodes = currentEpisodes;
                  if (episodes && episodes.length > 0) {
                    const directEpisodes = episodes.filter((ep: any) => ep.direct_links);
                    if (directEpisodes.length > 0) {
                      const ep = directEpisodes[directEpisodes.length - 1];
                      handleEpisodeClick(ep);
                    }
                  }
                }}
              >
                <Play size={20} className="fill-current" /> Смотреть
              </button>
              
              <button 
                onClick={() => toggleFavorite(details as any)}
                className={clsx("tv-focusable", 
                  "p-3.5 rounded-lg font-bold transition-colors flex items-center justify-center border",
                  isFav ? "bg-primary/20 border-primary text-primary" : "bg-white/10 border-white/10 text-white hover:bg-white/20"
                )}
              >
                <Heart size={20} fill={isFav ? "currentColor" : "none"} />
              </button>

              <button className="tv-focusable p-3.5 rounded-lg font-bold bg-white/10 border border-white/10 text-white hover:bg-white/20 transition-colors flex items-center justify-center">
                <Share2 size={20} />
              </button>

              {!isAggregatedMode && (
                <a
                  href={details?.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tv-focusable p-3.5 rounded-lg font-bold bg-white/10 border border-white/10 text-white hover:bg-white/20 transition-colors flex items-center justify-center"
                  title="Открыть на оригинальном сайте"
                >
                  <ExternalLink size={20} />
                </a>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 mt-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-12">
          {/* Summary */}
          {displayDescription && (
            <section>
              <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <Info size={24} className="text-primary" /> Описание
              </h3>
              <p 
                className="text-text-muted leading-relaxed text-lg" 
                dangerouslySetInnerHTML={{ 
                  __html: displayDescription.replace(/\n/g, '<br/>') 
                }} 
              />
            </section>
          )}

          {/* Episodes List */}
          <section>
            <div className="flex items-center gap-8 mb-6 border-b border-white/5">
              <button 
                onClick={() => setActiveTab('episodes')}
                className={clsx("tv-focusable", 
                  "pb-4 text-2xl font-bold flex items-center gap-2 transition-colors relative",
                  activeTab === 'episodes' ? "text-primary" : "text-text-muted hover:text-white"
                )}
              >
                <List size={24} /> 
                Эпизоды
                {isAggregatedMode && selectedDubber && (
                  <span className="text-sm text-text-muted font-normal">({selectedDubber})</span>
                )}
                {activeTab === 'episodes' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
              </button>
              
              {!isAggregatedMode && details?.torrents && details.torrents.length > 0 && (
                <button 
                  onClick={() => {
                    setActiveTab('torrents');
                    setTimeout(() => fetchTorrentMeta(details.torrents), 0);
                  }}
                  className={clsx("tv-focusable", 
                    "pb-4 text-2xl font-bold flex items-center gap-2 transition-colors relative",
                    activeTab === 'torrents' ? "text-primary" : "text-text-muted hover:text-white"
                  )}
                >
                  <Download size={24} /> Торренты
                  {activeTab === 'torrents' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
                </button>
              )}
            </div>

            {activeTab === 'episodes' ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div />
                  {currentEpisodes && currentEpisodes.length > 0 && (
                    <span className="text-text-muted">
                      {new Set(currentEpisodes.map((ep: any) => ep.uniq || ep.title)).size} серий
                    </span>
                  )}
                </div>

                {isEpLoading || isLoadingAggregated ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <div key={i} className="h-24 bg-white/5 animate-pulse rounded-xl" />
                    ))}
                  </div>
                ) : currentEpisodes && currentEpisodes.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(() => {
                      // Group episodes by uniq identifier
                      const groups = new Map<string, any[]>();
                      currentEpisodes.forEach((ep: any) => {
                        const key = ep.uniq || ep.title;
                        if (!groups.has(key)) groups.set(key, []);
                        groups.get(key)!.push(ep);
                      });
                      
                      return Array.from(groups.entries()).reverse().map(([uniq, episodes]) => {
                        const selectedEp = episodes[0];
                        const sourceInfo = isAggregatedMode 
                          ? (selectedEp as AggregatedEpisode).source_title 
                          : selectedEp.service;
                        
                        return (
                          <motion.div
                            key={uniq}
                            tabIndex={0}
                            onClick={() => handleEpisodeClick(selectedEp)}
                            className="tv-focusable glass p-4 rounded-xl cursor-pointer hover:border-primary/50 transition-all group focus:scale-105 focus:border-primary"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 flex-shrink-0 bg-white/5 rounded-full flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <Play size={20} className="text-white group-hover:text-primary ml-1" />
                              </div>
                              <div className="overflow-hidden flex-1">
                                <h4 className="text-white font-semibold truncate" title={selectedEp.title || uniq}>
                                  {selectedEp.title || uniq}
                                </h4>
                                {sourceInfo && (
                                  <p className="text-xs text-text-muted mt-1 truncate">{sourceInfo}</p>
                                )}
                                {isAggregatedMode && (selectedEp as AggregatedEpisode).source && (
                                  <p className="text-xs text-primary/70 mt-0.5">
                                    {(selectedEp as AggregatedEpisode).source}
                                  </p>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <p className="text-text-muted">Эпизоды не найдены.</p>
                )}
              </>
            ) : (
              <div className="space-y-4">
                {details?.torrents?.map((torrent: any, idx: number) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="glass p-5 rounded-2xl flex flex-col md:flex-row md:items-center gap-6 hover:border-primary/30 transition-all group"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-white font-bold text-lg group-hover:text-primary transition-colors">{torrent.title}</h4>
                        {(torrentMeta[torrent.url]?.quality || extractQuality(torrent.title)) && (
                          <span className="text-xs font-bold px-2 py-0.5 bg-primary/20 text-primary border border-primary/30 rounded">
                            {torrentMeta[torrent.url]?.quality || extractQuality(torrent.title)}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-text-muted">
                        <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg">
                          <HardDrive size={14} className="text-primary" />
                          {torrent.size}
                        </div>
                        {torrent.seeders && (
                          <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg">
                            <ArrowUpCircle size={14} className="text-green-500" />
                            <span className="text-green-500 font-medium">{torrent.seeders}</span>
                          </div>
                        )}
                        {torrent.leechers && (
                          <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg">
                            <ArrowDownCircle size={14} className="text-red-500" />
                            <span className="text-red-500 font-medium">{torrent.leechers}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <a
                      href={torrent.url}
                      download
                      className="tv-focusable bg-primary text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20"
                    >
                      <Download size={20} /> Скачать
                    </a>
                  </motion.div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          {/* Sources list for aggregated mode */}
          {isAggregatedMode && aggregatedData?.sources && aggregatedData.sources.length > 0 && (
            <div className="glass p-6 rounded-2xl border border-white/5">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Layers size={18} className="text-primary" /> Источники
              </h3>
              <div className="space-y-3">
                {aggregatedData.sources.map((src, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div>
                      <p className="text-white font-medium text-sm">{src.source}</p>
                      {src.dubbers && src.dubbers.length > 0 && (
                        <p className="text-text-muted text-xs">{src.dubbers.join(', ')}</p>
                      )}
                    </div>
                    <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded">
                      {src.episodes_count} эп
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="glass p-6 rounded-2xl border border-white/5">
            <h3 className="text-lg font-bold text-white mb-4">Информация</h3>
            <dl className="space-y-4 text-sm">
              {!isAggregatedMode && details?.country && (
                <div className="grid grid-cols-3 gap-4 border-b border-white/5 pb-4">
                  <dt className="text-text-muted">Страна</dt>
                  <dd className="col-span-2 text-white font-medium">{details.country}</dd>
                </div>
              )}
              {!isAggregatedMode && details?.author && (
                <div className="grid grid-cols-3 gap-4 border-b border-white/5 pb-4">
                  <dt className="text-text-muted">Автор</dt>
                  <dd className="col-span-2 text-white font-medium">{details.author}</dd>
                </div>
              )}
              {availableDubbers.length > 0 && (
                <div className="grid grid-cols-3 gap-4 border-b border-white/5 pb-4">
                  <dt className="text-text-muted">Озвучка</dt>
                  <dd className="col-span-2 text-white font-medium">
                    {isAggregatedMode 
                      ? `${availableDubbers.length} вариантов`
                      : availableDubbers.join(', ')
                    }
                  </dd>
                </div>
              )}
              {!isAggregatedMode && details?.producers && details.producers.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                  <dt className="text-text-muted">Студия</dt>
                  <dd className="col-span-2 text-white font-medium">{details.producers.join(', ')}</dd>
                </div>
              )}
              {isAggregatedMode && aggregatedData?.shikimori?.studios && (
                <div className="grid grid-cols-3 gap-4">
                  <dt className="text-text-muted">Студия</dt>
                  <dd className="col-span-2 text-white font-medium">
                    {aggregatedData.shikimori.studios.map(s => s.name).join(', ')}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
