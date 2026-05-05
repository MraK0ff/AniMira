import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getAnimeDetails, getAnimeEpisodes } from '../api/client';
import { Play, Heart, Share2, Info, List, Clock, Calendar, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import clsx from 'clsx';
import { useState } from 'react';

export default function AnimeDetail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const source = searchParams.get('source');
  const url = searchParams.get('url');

  const { isFavorite, toggleFavorite } = useStore();
  const [selectedQuality, setSelectedQuality] = useState<'360' | '720'>('720');

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
                <span key={g} className="text-xs font-semibold px-2.5 py-1 bg-white/10 backdrop-blur-md rounded-full text-white">
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
                <div className="flex items-center gap-1.5"><List size={16} className="text-primary" /> {details.episodes}</div>
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
                className="bg-white text-black px-8 py-3.5 rounded-lg font-bold hover:bg-white/90 transition-colors flex items-center gap-2"
                onClick={() => {
                  if (epData?.episodes?.[0]) {
                    const ep = epData.episodes[0];
                    navigate(`/player?source=${source}&episode_url=${encodeURIComponent(ep.url)}`, { state: { episode: ep } });
                  }
                }}
              >
                <Play size={20} className="fill-current" /> Смотреть
              </button>
              
              <button 
                onClick={() => toggleFavorite(details as any)}
                className={clsx(
                  "p-3.5 rounded-lg font-bold transition-colors flex items-center justify-center border",
                  isFav ? "bg-primary/20 border-primary text-primary" : "bg-white/10 border-white/10 text-white hover:bg-white/20"
                )}
              >
                <Heart size={20} fill={isFav ? "currentColor" : "none"} />
              </button>

              <button className="p-3.5 rounded-lg font-bold bg-white/10 border border-white/10 text-white hover:bg-white/20 transition-colors flex items-center justify-center">
                <Share2 size={20} />
              </button>
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
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                <List size={24} className="text-primary" /> Эпизоды
              </h3>
              {epData && epData.episodes.length > 0 && (
                <span className="text-text-muted">{epData.episodes.length} серий</span>
              )}
            </div>

            {isEpLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="h-24 bg-white/5 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : epData?.episodes ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {epData.episodes.map((ep, idx) => (
                  <motion.div
                    key={ep.url || idx}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => navigate(`/player?source=${source}&episode_url=${encodeURIComponent(ep.url)}`, { state: { episode: ep } })}
                    className="glass p-4 rounded-xl cursor-pointer hover:border-primary/50 transition-colors group flex items-center gap-4"
                  >
                    <div className="w-12 h-12 flex-shrink-0 bg-white/5 rounded-full flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Play size={20} className="text-white group-hover:text-primary ml-1" />
                    </div>
                    <div className="overflow-hidden">
                      <h4 className="text-white font-semibold truncate" title={ep.title}>{ep.title}</h4>
                      {ep.service && <p className="text-xs text-text-muted mt-1">{ep.service}</p>}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-text-muted">Эпизоды не найдены.</p>
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
