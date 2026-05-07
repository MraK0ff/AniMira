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
        <div className="relative h-[50vh] md:h-[60vh] w-full mb-8 md:mb-12">
          <div className="absolute inset-0">
            <img
              src={listData.items[0].cover}
              alt="Hero"
              className="w-full h-full object-cover opacity-40 md:opacity-50 blur-sm"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-bg-base via-bg-base/60 to-transparent md:via-bg-base/50" />
            <div className="absolute inset-0 bg-gradient-to-r from-bg-base via-bg-base/60 to-transparent md:via-bg-base/50" />
          </div>

          <div className="absolute bottom-0 left-0 px-4 md:px-6 lg:px-12 pb-8 md:pb-12 w-full max-w-6xl flex flex-col md:flex-row items-start md:items-end gap-4 md:gap-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="hidden md:block w-48 lg:w-64 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10 flex-shrink-0"
            >
              <img
                src={listData.items[0].cover}
                alt="Poster"
                className="w-full h-full object-cover"
              />
            </motion.div>

            <div className="flex-1 min-w-0">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-black text-white mb-2 shadow-black drop-shadow-2xl line-clamp-2 md:line-clamp-none"
              >
                {listData.items[0].title}
              </motion.h1>

              {listData.items[0].additional_title && (
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="text-sm sm:text-base md:text-lg lg:text-2xl font-medium text-white/70 mb-4 md:mb-6 line-clamp-1"
                >
                  {listData.items[0].additional_title}
                </motion.p>
              )}


              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex flex-wrap gap-3 md:gap-4"
              >
                <Link
                  to={`/anime?source=${currentSource}&url=${encodeURIComponent(listData.items[0].url)}`}
                  tabIndex={0}
                  className="tv-focusable bg-primary text-white px-4 md:px-8 py-2.5 md:py-3 rounded-lg font-bold hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-lg shadow-primary/20 text-sm md:text-base"
                >
                  <Play size={18} fill="currentColor" className="md:w-5 md:h-5" />
                  <span className="hidden sm:inline">Смотреть</span>
                  <span className="sm:hidden">Смотреть</span>
                </Link>
                <Link
                  to={`/anime?source=${currentSource}&url=${encodeURIComponent(listData.items[0].url)}`}
                  tabIndex={0}
                  className="tv-focusable bg-white/10 backdrop-blur-md border border-white/20 text-white px-4 md:px-8 py-2.5 md:py-3 rounded-lg font-bold hover:bg-white/20 transition-colors flex items-center gap-2 text-sm md:text-base"
                >
                  <Info size={18} className="md:w-5 md:h-5" />
                  <span className="hidden sm:inline">Подробнее</span>
                  <span className="sm:hidden">Инфо</span>
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
        <div className="px-4 md:px-6 py-2 md:py-4 text-xs text-text-muted truncate">
          Source: {currentSource || 'none'} | items: {Array.isArray(listData?.items) ? listData?.items?.length || 0 : 0}
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
        <div className="px-4 md:px-6 py-8 md:py-12 text-center">
          <p className="text-text-muted text-sm md:text-base">No anime found for source: {currentSource}</p>
          <p className="text-text-muted text-xs md:text-sm mt-2">Try selecting a different source</p>
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
