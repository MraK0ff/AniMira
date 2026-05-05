import { useQuery } from '@tanstack/react-query';
import { getAnimeList } from '../api/client';
import { useStore } from '../store/useStore';
import AnimeCard, { SkeletonCard } from '../components/AnimeCard';
import Carousel from '../components/Carousel';
import { motion } from 'framer-motion';

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
          
          <div className="absolute bottom-0 left-0 px-6 md:px-12 pb-12 w-full max-w-4xl">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-6xl font-black text-white mb-4 shadow-black drop-shadow-2xl"
            >
              {listData.items[0].title}
            </motion.h1>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex gap-4"
            >
              <button className="bg-white text-black px-8 py-3 rounded-lg font-bold hover:bg-white/90 transition-colors flex items-center gap-2">
                Смотреть
              </button>
              <button className="bg-white/20 backdrop-blur-md text-white px-8 py-3 rounded-lg font-bold hover:bg-white/30 transition-colors">
                Подробнее
              </button>
            </motion.div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <Carousel title="Latest Releases">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </Carousel>
      )}

      {/* Latest Carousel */}
      {!isLoading && listData && listData.items.length > 0 && (
        <Carousel title={listData.categories?.[0]?.name || "Latest Releases"}>
          {listData.items.map((anime) => (
            <AnimeCard key={anime.url} anime={anime} source={currentSource} />
          ))}
        </Carousel>
      )}

      {/* Category Carousel */}
      {!isCatLoading && catData && catData.items.length > 0 && (
        <Carousel title={listData?.categories?.[1]?.name || "More Anime"}>
          {catData.items.map((anime) => (
            <AnimeCard key={anime.url} anime={anime} source={currentSource} />
          ))}
        </Carousel>
      )}
    </div>
  );
}
