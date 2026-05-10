import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getVideoInfo } from '../api/client';
import Hls from 'hls.js';
import { 
  ArrowLeft, Loader2, Settings, ChevronLeft, ChevronRight, List,
  Play, Pause, RotateCcw, RotateCw, Maximize, Minimize, 
  Unlock, Lock, Sparkles
} from 'lucide-react';
import { Episode } from '../types/api';
import clsx from 'clsx';
import { useAnime4K, Anime4KMode, Anime4KQuality } from '../hooks/useAnime4K';

export default function Player() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const source = searchParams.get('source');
  const fallbackEpisodeUrl = searchParams.get('episode_url');
  const torrserveUrl = searchParams.get('torrserve_url');
  
  const episode = location.state?.episode as Episode | undefined;
  const episodes = location.state?.episodes as Episode[] | undefined;
  
  // Flag to indicate this is a TorrServe stream
  const isTorrserveMode = !!torrserveUrl;
  
  const [currentEpisode, setCurrentEpisode] = useState<Episode | undefined>(episode);
  const videoRef = useRef<HTMLVideoElement>(null);
  const anime4kCanvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [showAnime4K, setShowAnime4K] = useState(false);
  
  // Initialize Anime4K
  const anime4k = useAnime4K(videoRef, anime4kCanvasRef);
  
  // Video state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Anime4K mode/quality labels
  const anime4kModeLabels: Record<Anime4KMode, string> = {
    'OFF': 'Выкл',
    'A': 'A (Восстановление)',
    'B': 'B (Мягкое)',
    'C': 'C (Шумоподавление)',
    'A_PLUS': 'A+ (Улучшенное)',
    'B_PLUS': 'B+ (Мягкое+)',
    'C_PLUS': 'C+ (Гибридное)',
  };

  const anime4kQualityLabels: Record<Anime4KQuality, string> = {
    'S': 'Быстро',
    'M': 'Баланс',
    'L': 'Качество',
  };

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

  const { data: videoInfo, isLoading: isApiLoading } = useQuery({
    queryKey: ['video', source, activeUrl],
    queryFn: () => getVideoInfo(source!, activeUrl),
    enabled: !!source && !!activeUrl && !isTorrserveMode
  });
  
  // In TorrServe mode, we're not loading from API
  const isLoading = isTorrserveMode ? false : isApiLoading;

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

  // Handle TorrServe URL - play directly without API
  useEffect(() => {
    if (!torrserveUrl || !videoRef.current) return;
    
    const video = videoRef.current;
    let hls: Hls | null = null;
    
    // For TorrServe URLs, we play directly since it's a local stream
    // No need for proxy since TorrServe runs on local network
    const streamUrl = decodeURIComponent(torrserveUrl);
    
    // Check if it's an m3u8 stream
    if (streamUrl.includes('.m3u8') || streamUrl.includes('m3u8')) {
      if (Hls.isSupported()) {
        hls = new Hls();
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(e => console.log('Autoplay prevented', e));
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            setError('Ошибка загрузки потока от TorrServe');
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        video.addEventListener('loadedmetadata', () => {
          video.play().catch(e => console.log('Autoplay prevented', e));
        });
      }
    } else {
      // Direct MP4 or other format
      video.src = streamUrl;
      video.play().catch(e => console.log('Autoplay prevented', e));
    }
    
    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [torrserveUrl]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, []);

  // Controls auto-hide
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (!isLocked) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isLocked]);

  useEffect(() => {
    if (showControls) {
      resetControlsTimeout();
    }
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [showControls, resetControlsTimeout]);

  // Control functions
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  };

  const skip = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
  };

  const seek = (time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    resetControlsTimeout();
  };

  const Anime4KPanel = () => (
    <div className="absolute bottom-20 left-4 sm:left-6 w-72 bg-black/95 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl overflow-hidden z-30 py-2">
      <div className="px-4 py-2 border-b border-white/10 mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-purple-400" />
          <h3 className="text-white/90 text-sm font-bold uppercase tracking-wider">Anime4K</h3>
        </div>
        <button 
          onClick={() => setShowAnime4K(false)}
          className="tv-focusable text-white/50 hover:text-white p-1"
          tabIndex={0}
        >
          <ChevronLeft size={16} />
        </button>
      </div>
      
      {/* Enable Toggle */}
      <div className="px-4 py-2 border-b border-white/10">
        <label className="flex items-center justify-between cursor-pointer group">
          <span className="text-white/70 text-sm">Включить Anime4K</span>
          <button
            onClick={() => anime4k.setEnabled(!anime4k.enabled)}
            className={clsx(
              "w-12 h-6 rounded-full transition-colors relative",
              anime4k.enabled ? "bg-purple-500" : "bg-white/20"
            )}
          >
            <span className={clsx(
              "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
              anime4k.enabled ? "left-7" : "left-1"
            )} />
          </button>
        </label>
        <p className="text-white/40 text-xs mt-1">
          Апскейлинг аниме с помощью ИИ-шейдеров
        </p>
        {!anime4k.isSupported && (
          <p className="text-red-400 text-xs mt-1">WebGL не поддерживается</p>
        )}
      </div>

      {/* Mode Selection */}
      <div className={clsx("px-4 py-2 border-b border-white/10", !anime4k.enabled && "opacity-50 pointer-events-none")}>
        <p className="text-white/50 text-xs font-bold uppercase mb-2">Режим</p>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {(['OFF', 'A', 'B', 'C', 'A_PLUS', 'B_PLUS', 'C_PLUS'] as Anime4KMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => anime4k.setMode(mode)}
              className={clsx(
                "w-full text-left px-3 py-2 text-sm rounded-lg transition-colors",
                anime4k.mode === mode
                  ? "bg-purple-500/30 text-white border border-purple-500/50"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              {anime4kModeLabels[mode]}
            </button>
          ))}
        </div>
      </div>

      {/* Quality Selection */}
      <div className={clsx("px-4 py-2", !anime4k.enabled && "opacity-50 pointer-events-none")}>
        <p className="text-white/50 text-xs font-bold uppercase mb-2">Качество</p>
        <div className="flex gap-2">
          {(['S', 'M', 'L'] as Anime4KQuality[]).map((quality) => (
            <button
              key={quality}
              onClick={() => anime4k.setQuality(quality)}
              className={clsx(
                "flex-1 px-3 py-2 text-sm rounded-lg transition-colors",
                anime4k.quality === quality
                  ? "bg-purple-500/30 text-white border border-purple-500/50"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              {anime4kQualityLabels[quality]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div 
      className="fixed inset-0 bg-black z-[100] flex flex-col"
      onMouseMove={handleMouseMove}
      onClick={() => !isLocked && setShowControls(true)}
    >
      {/* Top Bar Overlay */}
      <div className={clsx(
        "absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/90 via-black/50 to-transparent transition-all duration-300",
        showControls ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
      )}>
        <div className="flex items-start justify-between p-4 sm:p-6">
          {/* Left: Back + Title */}
          <div className="flex items-start gap-4">
            <button 
              onClick={() => navigate(-1)}
              className="tv-focusable text-white p-2 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
              tabIndex={0}
            >
              <ArrowLeft size={28} />
            </button>
            
            <div className="flex flex-col">
              <h1 className="text-white font-semibold text-lg sm:text-xl drop-shadow-lg line-clamp-2">
                {isTorrserveMode ? 'Поток от TorrServe' : (currentEpisode?.title || 'Плеер')}
              </h1>
              {!isTorrserveMode && episodes && episodes.length > 1 && (
                <p className="text-white/70 text-sm mt-1">
                  Серия {currentIndex + 1} из {episodes.length}
                </p>
              )}
              {isTorrserveMode && (
                <p className="text-white/50 text-sm mt-1">
                  Торрент-стриминг
                </p>
              )}
            </div>
          </div>

          {/* Right: Lock only */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Lock */}
            <button 
              onClick={() => setIsLocked(!isLocked)}
              className="tv-focusable text-white p-2 sm:p-2.5 hover:bg-white/10 rounded-full transition-colors"
              tabIndex={0}
              title={isLocked ? "Разблокировать" : "Заблокировать"}
            >
              {isLocked ? <Lock size={20} /> : <Unlock size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Center Controls Overlay */}
      <div 
        className={clsx(
          "absolute inset-0 z-10 flex items-center justify-center transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={(e) => {
          if (e.target === e.currentTarget) togglePlay();
        }}
      >
        {/* Episodes Panel (if open) - hidden in TorrServe mode */}
        {showEpisodes && episodes && !isTorrserveMode && (
          <div className="absolute top-20 right-4 sm:right-6 w-72 max-h-[50vh] bg-black/90 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl overflow-y-auto z-30 py-2">
            <div className="px-4 py-2 border-b border-white/10 mb-2 flex items-center justify-between">
              <h3 className="text-white/50 text-xs font-bold uppercase tracking-wider">Список серий</h3>
              <button 
                onClick={() => setShowEpisodes(false)}
                className="text-white/50 hover:text-white p-1"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
            {episodes.map((ep, idx) => (
              <button
                key={ep.url}
                onClick={() => {
                  setCurrentEpisode(ep);
                  setShowEpisodes(false);
                }}
                className={clsx(
                  "w-full text-left px-4 py-3 text-sm font-semibold transition-colors flex items-center justify-between",
                  currentEpisode?.url === ep.url
                    ? "bg-gray-600/30 text-white border-l-2 border-gray-500"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                <span className="truncate pr-4">{ep.title}</span>
                {currentEpisode?.url === ep.url && (
                  <div className="w-2 h-2 rounded-full bg-gray-500" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Center Play Controls */}
        <div className="flex items-center gap-4 sm:gap-6">
          {/* Rewind 10s */}
          <button
            onClick={() => skip(-10)}
            className="tv-focusable group relative flex flex-col items-center"
            tabIndex={0}
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center group-hover:bg-black/70 transition-colors border border-white/20">
              <RotateCcw size={24} className="text-white" />
            </div>
            <span className="text-white/70 text-xs mt-2 font-medium">10</span>
          </button>

          {/* Previous Episode - hidden in TorrServe mode */}
          {!isTorrserveMode && episodes && episodes.length > 1 && (
            <button
              onClick={() => {
                const prevEp = episodes[currentIndex - 1];
                if (prevEp) setCurrentEpisode(prevEp);
              }}
              disabled={currentIndex <= 0}
              className="tv-focusable w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              tabIndex={0}
            >
              <ChevronLeft size={28} className="text-white" />
            </button>
          )}

          {/* Play/Pause - Big Red Circle */}
          <button
            onClick={togglePlay}
            className="tv-focusable relative group"
            tabIndex={0}
          >
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gray-600/90 flex items-center justify-center shadow-lg shadow-gray-900/30 group-hover:bg-gray-500 transition-all group-hover:scale-105">
              {isPlaying ? (
                <Pause size={36} className="text-white" />
              ) : (
                <Play size={36} className="text-white ml-1" />
              )}
            </div>
          </button>

          {/* Next Episode - hidden in TorrServe mode */}
          {!isTorrserveMode && episodes && episodes.length > 1 && (
            <button
              onClick={() => {
                const nextEp = episodes[currentIndex + 1];
                if (nextEp) setCurrentEpisode(nextEp);
              }}
              disabled={currentIndex >= episodes.length - 1}
              className="tv-focusable w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-black/30 flex items-center justify-center hover:bg-black/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              tabIndex={0}
            >
              <ChevronRight size={28} className="text-white" />
            </button>
          )}

          {/* Forward 10s */}
          <button
            onClick={() => skip(10)}
            className="tv-focusable group relative flex flex-col items-center"
            tabIndex={0}
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center group-hover:bg-black/70 transition-colors border border-white/20">
              <RotateCw size={24} className="text-white" />
            </div>
            <span className="text-white/70 text-xs mt-2 font-medium">10</span>
          </button>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className={clsx(
        "absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-all duration-300",
        showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      )}>
        <div className="p-4 sm:p-6">
          {/* Progress Bar */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-white/80 text-sm font-medium min-w-[50px]">
              {formatTime(currentTime)}
            </span>
            
            <div className="flex-1 relative group">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={(e) => seek(Number(e.target.value))}
                className="w-full h-1.5 bg-white/30 rounded-full appearance-none cursor-pointer accent-gray-500 hover:h-2 transition-all"
                style={{
                  background: `linear-gradient(to right, #6b7280 ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.3) ${(currentTime / (duration || 1)) * 100}%)`
                }}
              />
            </div>
            
            <span className="text-white/80 text-sm font-medium min-w-[50px] text-right">
              {formatTime(duration)}
            </span>
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Episodes Toggle - hidden in TorrServe mode */}
              {!isTorrserveMode && episodes && episodes.length > 1 && (
                <button
                  onClick={() => {
                    setShowEpisodes(!showEpisodes);
                    setShowAnime4K(false);
                    setShowSettings(false);
                  }}
                  className={clsx(
                    "tv-focusable flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors",
                    showEpisodes ? "bg-gray-600 text-white" : "bg-white/10 text-white hover:bg-white/20"
                  )}
                  tabIndex={0}
                >
                  <List size={18} />
                  <span className="text-sm font-semibold">Серии</span>
                </button>
              )}
              
              {/* Quality Selector - hidden in TorrServe mode */}
              {!isTorrserveMode && qualities.length > 1 && (
                <div className="relative">
                  <button 
                    onClick={() => {
                      setShowSettings(!showSettings);
                      setShowEpisodes(false);
                      setShowAnime4K(false);
                    }}
                    className={clsx(
                      "tv-focusable flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors",
                      showSettings ? "bg-gray-600 text-white" : "bg-white/10 text-white hover:bg-white/20"
                    )}
                    tabIndex={0}
                  >
                    <Settings size={18} />
                    <span className="text-sm font-semibold">
                      {qualities.find(q => q.url === activeUrl)?.name || 'Качество'}
                    </span>
                  </button>
                  
                  {showSettings && (
                    <div className="absolute bottom-full left-0 mb-2 w-32 bg-black/95 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl overflow-hidden z-30">
                      {qualities.map(q => (
                        <button
                          key={q.url}
                          onClick={() => {
                            setActiveUrl(q.url);
                            setShowSettings(false);
                          }}
                          className={clsx(
                            "w-full text-left px-4 py-3 text-sm font-semibold transition-colors",
                            activeUrl === q.url 
                              ? "bg-gray-600 text-white" 
                              : "text-white/70 hover:bg-white/10 hover:text-white"
                          )}
                        >
                          {q.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Anime4K Toggle */}
              <button
                onClick={() => {
                  setShowAnime4K(!showAnime4K);
                  setShowEpisodes(false);
                  setShowSettings(false);
                }}
                className={clsx(
                  "tv-focusable flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors",
                  anime4k.enabled ? "bg-purple-500 text-white" : "bg-white/10 text-white hover:bg-white/20",
                  showAnime4K && "ring-2 ring-purple-400"
                )}
                tabIndex={0}
              >
                <Sparkles size={18} />
                <span className="text-sm font-semibold">
                  {anime4k.enabled ? '4K' : 'Anime4K'}
                </span>
              </button>
              
              {showAnime4K && <Anime4KPanel />}
            </div>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="tv-focusable text-white p-2 hover:bg-white/10 rounded-full transition-colors"
              tabIndex={0}
            >
              {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Video Container */}
      <div className="flex-1 relative bg-black flex items-center justify-center">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white z-10">
            <Loader2 size={48} className="animate-spin text-gray-500" />
            <p className="font-semibold text-lg">Загрузка плеера...</p>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white z-10">
            <div className="bg-gray-500/20 text-gray-400 p-4 rounded-xl border border-gray-500/50 text-center max-w-md">
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

        {/* Anime4K WebGL Canvas */}
        <canvas
          ref={anime4kCanvasRef}
          className={clsx(
            "absolute inset-0 w-full h-full object-contain",
            anime4k.enabled ? "z-[5]" : "z-0 pointer-events-none opacity-0"
          )}
        />

        <video
          ref={videoRef}
          className={clsx(
            "w-full h-full",
            anime4k.enabled ? "opacity-0 absolute inset-0" : "relative z-0"
          )}
          controls={false}
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
