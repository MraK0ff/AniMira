import { useEffect, useRef, useState, useMemo } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getVideoInfo } from '../api/client';
import Hls from 'hls.js';
import { ArrowLeft, Loader2, Settings } from 'lucide-react';
import { Episode } from '../types/api';
import clsx from 'clsx';

export default function Player() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const source = searchParams.get('source');
  const fallbackEpisodeUrl = searchParams.get('episode_url');
  
  const episode = location.state?.episode as Episode | undefined;
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Build qualities array
  const qualities = useMemo(() => {
    const q: { name: string; url: string }[] = [];
    if (episode?.url720) q.push({ name: '720p', url: episode.url720 });
    if (episode?.url360) q.push({ name: '360p', url: episode.url360 });
    if (episode?.links) {
      episode.links.forEach(l => {
        if (!q.some(existing => existing.url === l.url)) q.push(l);
      });
    }
    if (q.length === 0 && fallbackEpisodeUrl) {
      q.push({ name: 'Default', url: fallbackEpisodeUrl });
    }
    return q;
  }, [episode, fallbackEpisodeUrl]);

  const [activeUrl, setActiveUrl] = useState<string>(qualities[0]?.url || fallbackEpisodeUrl!);

  // Sync activeUrl when qualities list changes (e.g. user manually changed URL params)
  useEffect(() => {
    if (qualities.length > 0 && !qualities.some(q => q.url === activeUrl)) {
      setActiveUrl(qualities[0].url);
    }
  }, [qualities, activeUrl]);

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
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(videoInfo.url)}&referer=${encodeURIComponent(videoInfo.referer || '')}`;

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
          {episode?.title && (
            <h2 className="text-white font-semibold drop-shadow-md hidden md:block">
              {episode.title}
            </h2>
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
          autoPlay
          playsInline
        />
      </div>
    </div>
  );
}
