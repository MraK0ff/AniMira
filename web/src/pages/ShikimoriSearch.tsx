import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { aggregatedSearch } from '../api/client';
import { Search, Star, Globe, Layers, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ShikimoriSearch() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['shikimoriSearch', query],
    queryFn: () => aggregatedSearch(query),
    enabled: query.length > 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.length > 2) {
      // Query will be triggered by useQuery
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-20 px-6 md:px-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <Globe size={32} className="text-blue-400" />
            <h1 className="text-3xl md:text-4xl font-bold text-white">Поиск через Shikimori</h1>
          </div>
          <p className="text-text-muted text-lg max-w-2xl">
            Объединённый поиск аниме со всех источников. 
            Мы автоматически найдём все доступные озвучки и выведем их в едином списке.
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="mb-10">
          <div className="relative max-w-2xl">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Введите название аниме..."
              className="w-full bg-bg-elevated border border-white/10 rounded-xl px-6 py-4 pl-14 text-white placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-lg"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={24} />
            <button
              type="submit"
              disabled={isLoading || query.length < 3}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Поиск...' : 'Найти'}
            </button>
          </div>
        </form>

        {/* Results */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
            <p className="text-red-400">Ошибка при поиске. Попробуйте позже.</p>
          </div>
        )}

        {data && data.results.length === 0 && data.unmatched.length === 0 && query.length > 2 && !isLoading && (
          <div className="text-center py-20">
            <p className="text-text-muted text-lg">Ничего не найдено по запросу "{query}"</p>
            <p className="text-text-muted mt-2">Попробуйте изменить запрос</p>
          </div>
        )}

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-bg-elevated rounded-xl p-4 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-24 h-32 bg-white/5 rounded-lg" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 bg-white/5 rounded w-3/4" />
                    <div className="h-3 bg-white/5 rounded w-1/2" />
                    <div className="h-3 bg-white/5 rounded w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {data && data.results.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-text-muted">
                Найдено {data.shikimori_matches} совпадений
                {data.unmatched_count > 0 && ` (+${data.unmatched_count} без совпадения)`}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.results.map((result, idx) => {
                const shiki = result.shikimori;
                const poster = shiki.poster?.originalUrl || shiki.poster?.mainUrl;
                
                return (
                  <motion.div
                    key={result.shikimori_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => navigate(`/anime?shikimori_id=${result.shikimori_id}`)}
                    className="tv-focusable group bg-bg-elevated hover:bg-bg-elevated/80 border border-white/5 hover:border-primary/30 rounded-xl p-4 cursor-pointer transition-all"
                  >
                    <div className="flex gap-4">
                      {/* Poster */}
                      <div className="w-20 h-28 flex-shrink-0 rounded-lg overflow-hidden bg-white/5">
                        {poster ? (
                          <img 
                            src={poster} 
                            alt={shiki.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-text-muted text-xs">
                            Нет постера
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-bold text-lg line-clamp-2 mb-1 group-hover:text-primary transition-colors">
                          {shiki.russian || shiki.name}
                        </h3>
                        {shiki.russian && shiki.name !== shiki.russian && (
                          <p className="text-text-muted text-sm line-clamp-1 mb-2">{shiki.name}</p>
                        )}

                        {/* Meta */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          {shiki.score && Number(shiki.score) > 0 && (
                            <span className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded">
                              <Star size={10} fill="currentColor" /> {Number(shiki.score).toFixed(1)}
                            </span>
                          )}
                          {shiki.kind && (
                            <span className="text-xs text-text-muted bg-white/5 px-2 py-0.5 rounded">
                              {shiki.kind.toUpperCase()}
                            </span>
                          )}
                          {shiki.status && (
                            <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">
                              {shiki.status}
                            </span>
                          )}
                        </div>

                        {/* Sources count */}
                        <div className="flex items-center gap-2 text-sm">
                          <Layers size={14} className="text-green-400" />
                          <span className="text-green-400 font-medium">
                            {result.source_count} {result.source_count === 1 ? 'источник' : result.source_count < 5 ? 'источника' : 'источников'}
                          </span>
                        </div>

                        {/* Episodes info */}
                        {shiki.episodes > 0 && (
                          <p className="text-text-muted text-xs mt-2">
                            {shiki.episodesAired || 0} / {shiki.episodes} эпизодов
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Sources preview */}
                    {result.sources.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/5">
                        <div className="flex flex-wrap gap-2">
                          {result.sources.slice(0, 3).map((src, i) => (
                            <span 
                              key={i} 
                              className="text-xs text-text-muted bg-white/5 px-2 py-1 rounded truncate max-w-[120px]"
                              title={src.source}
                            >
                              {src.source}
                            </span>
                          ))}
                          {result.sources.length > 3 && (
                            <span className="text-xs text-text-muted">
                              +{result.sources.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Arrow indicator */}
                    <div className="mt-3 flex items-center gap-1 text-primary text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>Перейти к просмотру</span>
                      <ArrowRight size={16} />
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Unmatched results - shown as main results when no Shikimori matches */}
            {data.unmatched && data.unmatched.length > 0 && (
              <div className={data.results.length > 0 ? "mt-10" : ""}>
                {data.results.length > 0 && (
                  <h3 className="text-xl font-bold text-white mb-4">Дополнительные результаты</h3>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.unmatched.map((item, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => navigate(`/anime?source=${item.source}&url=${encodeURIComponent(item.url)}`)}
                      className="tv-focusable group bg-bg-elevated hover:bg-bg-elevated/80 border border-white/5 hover:border-primary/30 rounded-xl p-4 cursor-pointer transition-all"
                    >
                      <div className="flex gap-4">
                        {/* Poster */}
                        <div className="w-20 h-28 flex-shrink-0 rounded-lg overflow-hidden bg-white/5">
                          {item.cover && !item.cover.startsWith('script') ? (
                            <img 
                              src={item.cover} 
                              alt={item.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-text-muted text-xs">
                              Нет постера
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-bold text-lg line-clamp-2 mb-1 group-hover:text-primary transition-colors">
                            {item.title}
                          </h3>
                          {item.additional_title && item.additional_title !== item.title && (
                            <p className="text-text-muted text-sm line-clamp-1 mb-2">{item.additional_title}</p>
                          )}

                          {/* Source badge */}
                          <div className="flex items-center gap-2 mt-3">
                            <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded">
                              {item.source}
                            </span>
                            {item.episodes_aired && (
                              <span className="text-xs text-text-muted bg-white/5 px-2 py-1 rounded">
                                {item.episodes_aired}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
