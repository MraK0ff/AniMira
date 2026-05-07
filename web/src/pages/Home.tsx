import { useQuery } from '@tanstack/react-query';
import { getAnimeList } from '../api/client';
import { useStore } from '../store/useStore';
import AnimeCard, { SkeletonCard } from '../components/AnimeCard';
import Carousel from '../components/Carousel';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Play, Info } from 'lucide-react';

export default function Home() {
  const { currentSource } = useStore();

  // Fetch initial list (popular/latest)
  const { data: listData, isLoading } = useQuery({
    queryKey: ['animeList', currentSource, 1],
    queryFn: () => getAnimeList(currentSource, 1),
    enabled: !!currentSource
  });

  // Example of fetching a specific category if categories are available
  const category1 = listData?.categories?.[1]?.tag;
  const { data: catData, isLoading: isCatLoading } = useQuery({
    queryKey: ['animeList', currentSource, 1, category1],
    queryFn: () => getAnimeList(currentSource, 1, category1),
    enabled: !!currentSource && !!category1
  });

  return (
    <div className="min-h-screen pb-20">
      {/* Hero Banner (Using first item of the list) */}
      {!isLoading && listData?.items?.[0] && (
        <div className="relative h-[60vh] w-full mb-12">
          <div className="absolute inset-0">
            <img
              src={listData.items[0].cover}
              alt="Hero"
              className="w-full h-full object-cover opacity-50 blur-sm"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-bg-base via-bg-base/50 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-bg-base via-bg-base/50 to-transparent" />
          </div>

          <div className="absolute bottom-0 left-0 px-6 md:px-12 pb-12 w-full max-w-6xl flex flex-col md:flex-row items-end gap-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="hidden md:block w-48 lg:w-64 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10"
            >
              <img
                src={listData.items[0].cover}
                alt="Poster"
                className="w-full h-full object-cover"
              />
            </motion.div>

            <div className="flex-1">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl md:text-6xl font-black text-white mb-2 shadow-black drop-shadow-2xl"
              >
                {listData.items[0].title}
              </motion.h1>

              {listData.items[0].additional_title && (
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="text-lg md:text-2xl font-medium text-white/70 mb-6 line-clamp-1"
                >
                  {listData.items[0].additional_title}
                </motion.p>
              )}


              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex gap-4"
              >
                <Link
                  to={`/anime?source=${currentSource}&url=${encodeURIComponent(listData.items[0].url)}`}
                  tabIndex={0}
                  className="tv-focusable bg-primary text-white px-8 py-3 rounded-lg font-bold hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-lg shadow-primary/20"
                >
                  <Play size={20} fill="currentColor" />
                  Смотреть
                </Link>
                <Link
                  to={`/anime?source=${currentSource}&url=${encodeURIComponent(listData.items[0].url)}`}
                  tabIndex={0}
                  className="tv-focusable bg-white/10 backdrop-blur-md border border-white/20 text-white px-8 py-3 rounded-lg font-bold hover:bg-white/20 transition-colors flex items-center gap-2"
                >
                  <Info size={20} />
                  Подробнее
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <Carousel title="Latest Releases">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </Carousel>
      )}

      {/* Debug info */}
      {!isLoading && (
        <div className="px-6 py-4 text-xs text-text-muted">
          Source: {currentSource || 'none'} | 
          listData: {listData ? 'yes' : 'no'} | 
          items isArray: {Array.isArray(listData?.items) ? 'yes' : 'no'} | 
          items length: {listData?.items?.length || 0}
        </div>
      )}

      {/* Latest Carousel */}
      {!isLoading && listData && Array.isArray(listData.items) && listData.items.length > 0 && (
        <Carousel title={listData.categories?.[0]?.name || "Latest Releases"}>
          {listData.items.map((anime) => (
            <AnimeCard key={anime.url} anime={anime} source={currentSource} />
          ))}
        </Carousel>
      )}

      {/* Empty state */}
      {!isLoading && (!listData || !Array.isArray(listData.items) || listData.items.length === 0) && (
        <div className="px-6 py-12 text-center">
          <p className="text-text-muted">No anime found for source: {currentSource}</p>
          <p className="text-text-muted text-sm mt-2">Try selecting a different source</p>
        </div>
      )}

      {/* Category Carousel */}
      {!isCatLoading && catData && Array.isArray(catData.items) && catData.items.length > 0 && (
        <Carousel title={listData?.categories?.[1]?.name || "More Anime"}>
          {catData.items.map((anime) => (
            <AnimeCard key={anime.url} anime={anime} source={currentSource} />
          ))}
        </Carousel>
      )}
    </div>
  );
}
