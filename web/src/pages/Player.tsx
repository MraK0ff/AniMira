import { useEffect, useRef, useState, useMemo } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getVideoInfo } from '../api/client';
import Hls from 'hls.js';
import { ArrowLeft, Loader2, Settings, ChevronLeft, ChevronRight, List } from 'lucide-react';
import { Episode } from '../types/api';
import clsx from 'clsx';

export default function Player() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const source = searchParams.get('source');
  const fallbackEpisodeUrl = searchParams.get('episode_url');
  
  const episode = location.state?.episode as Episode | undefined;
  const episodes = location.state?.episodes as Episode[] | undefined;
  
  const [currentEpisode, setCurrentEpisode] = useState<Episode | undefined>(episode);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showEpisodes, setShowEpisodes] = useState(false);

  const currentIndex = useMemo(() => {
    if (!currentEpisode || !episodes) return -1;
    return episodes.findIndex(e => e.url === currentEpisode.url);
  }, [currentEpisode, episodes]);

  // Build qualities array
  const qualities = useMemo(() => {
    const q: { name: string; url: string }[] = [];
    if (currentEpisode?.url720) q.push({ name: '720p', url: currentEpisode.url720 });
    if (currentEpisode?.url360) q.push({ name: '360p', url: currentEpisode.url360 });
    if (currentEpisode?.links) {
      currentEpisode.links.forEach(l => {
        if (!q.some(existing => existing.url === l.url)) q.push(l);
      });
    }
    if (q.length === 0 && currentEpisode?.url) {
      q.push({ name: 'Default', url: currentEpisode.url });
    }
    if (q.length === 0 && fallbackEpisodeUrl) {
      q.push({ name: 'Default', url: fallbackEpisodeUrl });
    }
    return q;
  }, [currentEpisode, fallbackEpisodeUrl]);

  const [activeUrl, setActiveUrl] = useState<string>(qualities[0]?.url || fallbackEpisodeUrl!);

  // Sync activeUrl when qualities list changes (e.g. user manually changed URL params)
  useEffect(() => {
    if (qualities.length > 0 && !qualities.some(q => q.url === activeUrl)) {
      setActiveUrl(qualities[0].url);
    }
  }, [qualities, activeUrl]);

  // Update URL params when currentEpisode changes
  useEffect(() => {
    if (currentEpisode && source) {
      const params = new URLSearchParams(searchParams);
      params.set('episode_url', currentEpisode.url);
      navigate(`/player?${params.toString()}`, { 
        state: { ...location.state, episode: currentEpisode },
        replace: true 
      });
    }
  }, [currentEpisode, source]);

  const { data: videoInfo, isLoading } = useQuery({
    queryKey: ['video', source, activeUrl],
    queryFn: () => getVideoInfo(source!, activeUrl),
    enabled: !!source && !!activeUrl
  });

  useEffect(() => {
    if (!videoInfo || !videoRef.current) return;

    const video = videoRef.current;
    let hls: Hls | null = null;

    // Route everything through our proxy to avoid CORS and Referer 403 blocks
    const headers = {
      ...(videoInfo.headers || {}),
      Referer: videoInfo.referer || videoInfo.headers?.Referer || ''
    };
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://animira.onrender.com';
    const proxyUrl = `${API_BASE_URL}/api/proxy?url=${encodeURIComponent(videoInfo.url)}&headers=${encodeURIComponent(JSON.stringify(headers))}`;

    // Check if it's an m3u8 stream
    if (videoInfo.url.includes('.m3u8') || videoInfo.url.includes('m3u8')) {
      if (Hls.isSupported()) {
        hls = new Hls({
          xhrSetup: (xhr, url) => {
            // Apply custom headers if possible in browser environment
            // Note: Browsers block custom headers in simple GETs usually,
            // but we might need a proxy for full support.
            // For now, we trust the backend provided a direct usable URL or we use the proxy
          }
        });
        hls.loadSource(proxyUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(e => console.log('Autoplay prevented', e));
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            setError('Ошибка загрузки потока видео');
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        video.src = proxyUrl;
        video.addEventListener('loadedmetadata', () => {
          video.play().catch(e => console.log('Autoplay prevented', e));
        });
      }
    } else {
      // Direct MP4 or unknown format
      video.src = proxyUrl;
      video.play().catch(e => console.log('Autoplay prevented', e));
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [videoInfo]);

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col">
      {/* Top Bar Overlay */}
      <div className="absolute top-0 left-0 right-0 p-6 z-10 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between opacity-0 hover:opacity-100 transition-opacity">
        <button 
          onClick={() => navigate(-1)}
          className="text-white flex items-center gap-2 hover:text-primary transition-colors font-semibold drop-shadow-md"
        >
          <ArrowLeft size={24} /> Назад
        </button>

        <div className="flex items-center gap-4">
          {currentEpisode?.title && (
            <h2 className="text-white font-semibold drop-shadow-md hidden md:block">
              {currentEpisode.title}
            </h2>
          )}
          
          {episodes && episodes.length > 1 && (
            <div className="flex items-center bg-white/10 rounded-full p-1">
              <button
                disabled={currentIndex <= 0}
                onClick={() => {
                  const nextEp = episodes[currentIndex - 1];
                  if (nextEp) setCurrentEpisode(nextEp);
                }}
                className="p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Предыдущая серия"
              >
                <ChevronLeft size={20} className="text-white" />
              </button>
              
              <button
                onClick={() => setShowEpisodes(!showEpisodes)}
                className="px-3 py-1.5 hover:bg-white/10 rounded-full transition-colors flex items-center gap-2 text-white text-sm font-bold"
              >
                <List size={18} />
                <span className="hidden sm:inline">Серии</span>
              </button>

              <button
                disabled={currentIndex >= episodes.length - 1}
                onClick={() => {
                  const nextEp = episodes[currentIndex + 1];
                  if (nextEp) setCurrentEpisode(nextEp);
                }}
                className="p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Следующая серия"
              >
                <ChevronRight size={20} className="text-white" />
              </button>
            </div>
          )}

          {showEpisodes && episodes && (
            <div className="absolute top-full right-40 mt-2 w-64 max-h-[60vh] bg-[#18181b]/95 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl overflow-y-auto z-50 py-2 custom-scrollbar">
              <div className="px-4 py-2 border-b border-white/5 mb-2">
                <h3 className="text-white/50 text-xs font-bold uppercase tracking-wider">Список серий</h3>
              </div>
              {/* Show in reverse order if they are 1-N to match details page */}
              {[...episodes].reverse().map((ep) => (
                <button
                  key={ep.url}
                  onClick={() => {
                    setCurrentEpisode(ep);
                    setShowEpisodes(false);
                  }}
                  className={clsx(
                    "w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors flex items-center justify-between group",
                    currentEpisode?.url === ep.url ? "bg-primary/20 text-primary" : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <span className="truncate pr-4">{ep.title}</span>
                  {currentEpisode?.url === ep.url && <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.8)]" />}
                </button>
              ))}
            </div>
          )}
          
          {qualities.length > 1 && (
            <div className="relative">
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className="text-white p-2 hover:bg-white/10 rounded-full transition-colors flex items-center gap-2"
              >
                <Settings size={24} />
                <span className="text-sm font-semibold">{qualities.find(q => q.url === activeUrl)?.name || 'Качество'}</span>
              </button>
              
              {showSettings && (
                <div className="absolute top-full right-0 mt-2 w-32 bg-[#18181b]/95 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl overflow-hidden">
                  {qualities.map(q => (
                    <button
                      key={q.url}
                      onClick={() => {
                        setActiveUrl(q.url);
                        setShowSettings(false);
                      }}
                      className={clsx(
                        "w-full text-left px-4 py-3 text-sm font-semibold transition-colors",
                        activeUrl === q.url ? "bg-primary text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      {q.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Video Container */}
      <div className="flex-1 relative bg-black flex items-center justify-center">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white">
            <Loader2 size={48} className="animate-spin text-primary" />
            <p className="font-semibold text-lg">Загрузка плеера...</p>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white">
            <div className="bg-red-500/20 text-red-500 p-4 rounded-xl border border-red-500/50 text-center max-w-md">
              <p className="font-bold mb-2">Ошибка воспроизведения</p>
              <p className="text-sm">{error}</p>
            </div>
            <button 
              onClick={() => navigate(-1)}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              Вернуться
            </button>
          </div>
        )}

        <video
          ref={videoRef}
          className="w-full h-full"
          controls
          controlsList="nodownload noplaybackrate"
          disablePictureInPicture
          disableRemotePlayback
          autoPlay
          playsInline
          webkit-playsinline="true"
          x5-playsinline="true"
          x5-video-player-type="h5"
          x5-video-player-fullscreen="true"
          x5-video-orientation="portraint"
        />
      </div>
    </div>
  );
}
