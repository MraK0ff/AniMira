import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getAnimeDetails, getAnimeEpisodes, getTorrentInfo, type TorrentInfo } from '../api/client';
import { Play, Heart, Share2, Info, List, Clock, Calendar, Star, ExternalLink, Download, HardDrive, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import clsx from 'clsx';
import { useState } from 'react';

// Extract video quality from torrent title
function extractQuality(title: string): string | null {
  const patterns = [
    /(\d{3,4}p)/i,           // 1080p, 720p, 480p, 2160p
    /(4K|UHD)/i,             // 4K, UHD
    /(FHD|FullHD)/i,         // FHD, FullHD
    /(HD|SD)/i,              // HD, SD
  ];
  
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      return match[1].toUpperCase();
    }
  }
  return null;
}

// Extract episode number from title
function extractEpisodeNumber(title: string): number | null {
  // Match patterns like: - 05 [, - 5 [, серия 05, episode 5, etc.
  const patterns = [
    /[-\s]\s*(\d+)\s*\[/,      // " - 05 [" or "- 5 ["
    /\s(\d{2,3})\s*\[/,         // " 05 [" or " 108 ["
    /серия\s*(\d+)/i,           // "серия 05" or "серия 5"
    /episode\s*(\d+)/i,        // "episode 05"
    /ep\s*(\d+)/i,             // "ep 5"
    /\s(\d+)\s*\.\s*(mp4|mkv|avi)/i,  // " 05.mp4"
    /\[(\d{2,3})\]/,            // "[05]"
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

// Find episodes available in torrents but missing from episodes list
function findMissingEpisodesInTorrents(
  episodes: Array<{uniq?: string; title?: string}>,
  torrents: Array<{title: string; url: string; quality?: string}>
): Array<{episodeNum: number; torrent: {title: string; url: string}}> {
  const episodeNums = new Set<number>();
  
  // Collect episode numbers from episodes list
  episodes.forEach(ep => {
    const epKey = ep.uniq || ep.title || '';
    const num = extractEpisodeNumber(epKey);
    if (num) episodeNums.add(num);
  });
  
  // Find torrents for episodes not in the list
  const missing: Array<{episodeNum: number; torrent: {title: string; url: string}}> = [];
  const seenEpisodes = new Set<number>();
  
  torrents.forEach(torrent => {
    const num = extractEpisodeNumber(torrent.title);
    if (num && !episodeNums.has(num) && !seenEpisodes.has(num)) {
      seenEpisodes.add(num);
      missing.push({ episodeNum: num, torrent });
    }
  });
  
  return missing.sort((a, b) => a.episodeNum - b.episodeNum);
}

export default function AnimeDetail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const source = searchParams.get('source');
  const url = searchParams.get('url');

  const { isFavorite, toggleFavorite } = useStore();
  const [selectedSources, setSelectedSources] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<'episodes' | 'torrents'>('episodes');
  const [torrentMeta, setTorrentMeta] = useState<Record<string, TorrentInfo>>({});

  const { data: details, isLoading } = useQuery({
    queryKey: ['animeDetails', source, url],
    queryFn: () => getAnimeDetails(source!, url!),
    enabled: !!source && !!url
  });

  const { data: epData, isLoading: isEpLoading } = useQuery({
    queryKey: ['animeEpisodes', source, url],
    queryFn: () => getAnimeEpisodes(source!, url!),
    enabled: !!source && !!url
  });

  // Fetch torrent metadata
  const fetchTorrentMeta = async (torrents: Array<{url: string; title: string}> | undefined) => {
    if (!torrents) return;
    for (const torrent of torrents) {
      if (!torrentMeta[torrent.url]) {
        try {
          const info = await getTorrentInfo(torrent.url);
          setTorrentMeta(prev => ({ ...prev, [torrent.url]: info }));
        } catch {
          // ignore errors
        }
      }
    }
  };
  
  // Fetch metadata when details load
  if (details?.torrents && Object.keys(torrentMeta).length === 0) {
    fetchTorrentMeta(details.torrents);
  }

  if (isLoading || !details) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isFav = isFavorite(details.url);

  return (
    <div className="min-h-screen pb-20">
      {/* Hero Banner */}
      <div className="relative h-[60vh] md:h-[70vh] w-full">
        <div className="absolute inset-0">
          <img 
            src={details.cover || 'https://via.placeholder.com/1920x1080?text=No+Cover'} 
            alt={details.title} 
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-base via-bg-base/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-bg-base via-bg-base/50 to-transparent" />
        </div>
        
        <div className="absolute bottom-0 left-0 px-6 md:px-12 pb-12 w-full max-w-6xl flex flex-col md:flex-row gap-8 items-end">
          <motion.img
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            src={details.cover}
            alt="Poster"
            className="hidden md:block w-48 md:w-64 rounded-xl shadow-2xl border border-white/10"
          />
          
          <div className="flex-1">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap gap-2 mb-3"
            >
              {details.genres?.map(g => (
                <span key={g} className="text-xs font-semibold px-2.5 py-1 bg-white/10 backdrop-blur-md rounded-full text-white capitalize">
                  {g}
                </span>
              ))}
              {details.status && (
                <span className="text-xs font-semibold px-2.5 py-1 bg-primary/20 text-primary border border-primary/30 rounded-full">
                  {details.status}
                </span>
              )}
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-6xl font-black text-white mb-2 shadow-black drop-shadow-2xl leading-tight"
            >
              {details.title}
            </motion.h1>
            
            {details.additional_title && (
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-xl md:text-2xl text-text-muted font-medium mb-6"
              >
                {details.additional_title}
              </motion.h2>
            )}

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap items-center gap-6 text-sm font-medium text-white mb-8"
            >
              {details.production_year && (
                <div className="flex items-center gap-1.5"><Calendar size={16} className="text-primary" /> {details.production_year}</div>
              )}
              {details.episodes && (
                <div className="flex items-center gap-1.5">
                  <List size={16} className="text-primary" />
                  {details.episodes.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&')}
                </div>
              )}
              {details.ep_length && (
                <div className="flex items-center gap-1.5"><Clock size={16} className="text-primary" /> {details.ep_length}</div>
              )}
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex gap-4"
            >
              <button 
                className="tv-focusable bg-white text-black px-8 py-3.5 rounded-lg font-bold hover:bg-white/90 transition-colors flex items-center gap-2"
                onClick={() => {
                  if (epData?.episodes && Array.isArray(epData.episodes) && epData.episodes.length > 0) {
                    // Берем только эпизоды с прямыми ссылками
                    const directEpisodes = epData.episodes.filter(ep => ep.direct_links);
                    if (directEpisodes.length > 0) {
                      const ep = directEpisodes[directEpisodes.length - 1];
                      // Используем прямую ссылку если доступна, иначе embed
                      const videoUrl = ep.url720 || ep.url360 || ep.url;
                      navigate(`/player?source=${source}&episode_url=${encodeURIComponent(videoUrl)}`, { 
                        state: { episode: ep, episodes: epData.episodes } 
                      });
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

              <a
                href={details.url}
                target="_blank"
                rel="noopener noreferrer"
                className="tv-focusable p-3.5 rounded-lg font-bold bg-white/10 border border-white/10 text-white hover:bg-white/20 transition-colors flex items-center justify-center"
                title="Открыть на оригинальном сайте"
              >
                <ExternalLink size={20} />
              </a>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 mt-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-12">
          {/* Summary */}
          {details.summary && (
            <section>
              <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <Info size={24} className="text-primary" /> Описание
              </h3>
              <p className="text-text-muted leading-relaxed text-lg" dangerouslySetInnerHTML={{ __html: details.summary }} />
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
                <List size={24} /> Эпизоды
                {activeTab === 'episodes' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
              </button>
              
              {details.torrents && details.torrents.length > 0 && (
                <button 
                  onClick={() => {
                    setActiveTab('torrents');
                    // Fetch torrent metadata when switching to torrents tab
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
                {/* Recommendations for torrents */}
                {(() => {
                  if (!details?.torrents || !details.torrents.length) return null;
                  const episodes = epData?.episodes || [];
                  
                  // Find episodes only available in torrents
                  const missingInTorrents = findMissingEpisodesInTorrents(episodes, details.torrents);
                  
                  return (
                    <div className="space-y-3 mb-6">
                      {/* Missing episodes recommendation */}
                      {missingInTorrents.length > 0 && (
                        <div className="bg-primary/10 border border-primary/30 rounded-xl p-4">
                          <div className="flex items-start gap-3">
                            <Download size={20} className="text-primary flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-white font-medium mb-1">
                                {missingInTorrents.length === 1 ? 'Дополнительная серия доступна в торрентах' : 'Дополнительные серии доступны в торрентах'}
                              </p>
                              <p className="text-text-muted text-sm">
                                {missingInTorrents.length === 1 ? 'Серия' : 'Серии'} {missingInTorrents.slice(0, 5).map(m => m.episodeNum).join(', ')}
                                {missingInTorrents.length > 5 && ` и еще ${missingInTorrents.length - 5}`}
                                {' '}{missingInTorrents.length === 1 ? 'пока доступна' : 'пока доступны'} только в торрентах — будет загружена в плеер позже
                              </p>
                              <button
                                onClick={() => {
                                  setActiveTab('torrents');
                                  setTimeout(() => fetchTorrentMeta(details.torrents), 0);
                                }}
                                className="tv-focusable mt-2 text-sm text-primary hover:text-primary/80 font-medium"
                              >
                                Перейти к торрентам →
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="flex items-center justify-between mb-4">
                  <div />
                  {epData && epData.episodes.length > 0 && (
                    <span className="text-text-muted">
                      {new Set(epData.episodes.map(ep => ep.uniq || ep.title)).size} серий
                    </span>
                  )}
                </div>

                {isEpLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <div key={i} className="h-24 bg-white/5 animate-pulse rounded-xl" />
                    ))}
                  </div>
                ) : epData?.episodes && epData.episodes.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(() => {
                      // Group episodes by uniq identifier
                      const groups = new Map<string, typeof epData.episodes>();
                      epData.episodes.forEach(ep => {
                        const key = ep.uniq || ep.title;
                        if (!groups.has(key)) groups.set(key, []);
                        groups.get(key)!.push(ep);
                      });
                      
                      return Array.from(groups.entries()).reverse().map(([uniq, episodes]) => {
                        // Filter to only direct links by default
                        const directEpisodes = Array.isArray(episodes) ? episodes.filter(ep => ep.direct_links) : [];
                        const availableEpisodes = directEpisodes.length > 0 ? directEpisodes : episodes;
                        const hasMultiple = availableEpisodes.length > 1;
                        const selectedIdx = Math.min(selectedSources[uniq] ?? 0, availableEpisodes.length - 1);
                        const selectedEp = availableEpisodes[selectedIdx] || episodes[0];
                        
                        // Find 1080p torrent for this episode
                        const epNum = extractEpisodeNumber(uniq);
                        const torrent1080p = epNum && details?.torrents?.find(t => {
                          const tNum = extractEpisodeNumber(t.title);
                          if (tNum !== epNum) return false;
                          const meta = torrentMeta[t.url];
                          const quality = meta?.quality || extractQuality(t.title);
                          return quality === '1080P' || quality === '1080p';
                        });
                        
                        return (
                          <motion.div
                            key={uniq}
                            whileHover={{ scale: 1.02 }}
                            tabIndex={0}
                            onClick={() => {
                              // Используем 1080p (url), затем 720p, затем 480p
                              const videoUrl = selectedEp.url || selectedEp.url720 || selectedEp.url360 || selectedEp.url;
                              if (!videoUrl) return;
                              navigate(`/player?source=${source}&episode_url=${encodeURIComponent(videoUrl)}`, { 
                                state: { episode: selectedEp, episodes: epData.episodes } 
                              });
                            }}
                            className="tv-focusable glass p-4 rounded-xl cursor-pointer hover:border-primary/50 transition-colors group"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 flex-shrink-0 bg-white/5 rounded-full flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <Play size={20} className="text-white group-hover:text-primary ml-1" />
                              </div>
                              <div className="overflow-hidden flex-1">
                                <h4 className="text-white font-semibold truncate" title={selectedEp.title || uniq}>{selectedEp.title || uniq}</h4>
                                {selectedEp.service && <p className="text-xs text-text-muted mt-1">{selectedEp.service}</p>}
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-1">
                              {hasMultiple && (
                                <>
                                  {Array.isArray(episodes) && episodes.filter(ep => ep.direct_links).map((ep, idx, arr) => {
                                    // Find original index in full episodes array
                                    const originalIdx = episodes.indexOf(ep);
                                    return (
                                      <button
                                        key={ep.url}
                                        tabIndex={0}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedSources(prev => ({ ...prev, [uniq]: originalIdx }));
                                        }}
                                        className={`tv-focusable text-xs px-2 py-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
                                          selectedIdx === originalIdx
                                            ? 'bg-primary text-white'
                                            : 'bg-white/10 text-text-muted hover:bg-white/20'
                                        }`}
                                      >
                                        {arr.length > 1 ? `Прямая ${idx + 1}` : 'Прямая'}
                                      </button>
                                    );
                                  })}
                                </>
                              )}
                              {torrent1080p && (
                                <button
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Trigger download
                                    const link = document.createElement('a');
                                    link.href = torrent1080p.url;
                                    link.download = '';
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                  }}
                                  className="tv-focusable text-xs px-3 py-1.5 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-all flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-green-500 focus:scale-110 active:scale-95 font-semibold"
                                >
                                  <Download size={12} /> Торрент 1080p
                                </button>
                              )}
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
                {details.torrents?.map((torrent, idx) => (
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
                        {torrent.downloads && (
                          <div className="flex items-center gap-1.5">
                            <Star size={14} /> {torrent.downloads} скачиваний
                          </div>
                        )}
                        {torrent.date && (
                          <div className="flex items-center gap-1.5">
                            <Calendar size={14} /> {torrent.date}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3">
                      <a
                        href={torrent.url}
                        download={`${torrent.title?.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_') || 'torrent'}.torrent`}
                        className="tv-focusable bg-primary text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20"
                      >
                        <Download size={20} /> Скачать .torrent
                      </a>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className="glass p-6 rounded-2xl border border-white/5">
            <h3 className="text-lg font-bold text-white mb-4">Информация</h3>
            <dl className="space-y-4 text-sm">
              {details.country && (
                <div className="grid grid-cols-3 gap-4 border-b border-white/5 pb-4">
                  <dt className="text-text-muted">Страна</dt>
                  <dd className="col-span-2 text-white font-medium">{details.country}</dd>
                </div>
              )}
              {details.author && (
                <div className="grid grid-cols-3 gap-4 border-b border-white/5 pb-4">
                  <dt className="text-text-muted">Автор</dt>
                  <dd className="col-span-2 text-white font-medium">{details.author}</dd>
                </div>
              )}
              {details.dubbers && details.dubbers.length > 0 && (
                <div className="grid grid-cols-3 gap-4 border-b border-white/5 pb-4">
                  <dt className="text-text-muted">Озвучка</dt>
                  <dd className="col-span-2 text-white font-medium">{details.dubbers.join(', ')}</dd>
                </div>
              )}
              {details.producers && details.producers.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                  <dt className="text-text-muted">Студия</dt>
                  <dd className="col-span-2 text-white font-medium">{details.producers.join(', ')}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
