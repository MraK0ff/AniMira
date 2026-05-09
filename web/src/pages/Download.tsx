import { useEffect, useState } from 'react';
import { Download, Smartphone, CheckCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface VersionInfo {
  version_code: number;
  version_name: string;
  download_url: string;
  changelog: string;
}

export default function DownloadPage() {
  const navigate = useNavigate();
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://animira.onrender.com';
    
    fetch(`${API_BASE_URL}/api/version`)
      .then(res => res.json())
      .then(data => {
        setVersion(data);
        setLoading(false);
      })
      .catch(err => {
        setError('Не удалось загрузить информацию о версии');
        setLoading(false);
      });
  }, []);

  const handleDownload = () => {
    if (version?.download_url) {
      window.location.href = version.download_url;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1115] via-[#1a1d26] to-[#0f1115]">
      {/* Header */}
      <div className="p-4 sm:p-6">
        <button 
          onClick={() => navigate('/')}
          className="tv-focusable inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors px-3 py-2 rounded-full hover:bg-white/5"
          tabIndex={0}
        >
          <ArrowLeft size={20} />
          <span>Назад</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center px-4 py-8 sm:py-16">
        {/* Icon */}
        <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shadow-2xl shadow-red-900/30 mb-8">
          <Smartphone size={48} className="text-white sm:w-16 sm:h-16" />
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 text-center">
          AniMira <span className="text-red-500">TV</span>
        </h1>
        <p className="text-white/50 text-center mb-8 max-w-md">
          Android TV приложение для просмотра аниме
        </p>

        {/* Version Info */}
        {loading ? (
          <div className="flex items-center gap-3 text-white/50">
            <Loader2 size={20} className="animate-spin" />
            <span>Загрузка информации...</span>
          </div>
        ) : error ? (
          <div className="text-red-400 text-center">{error}</div>
        ) : version ? (
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/10">
              <span className="text-white/50 text-sm">Версия:</span>
              <span className="text-white font-semibold">{version.version_name}</span>
              <span className="text-white/30">|</span>
              <span className="text-white/50 text-sm">build {version.version_code}</span>
            </div>
            
            {version.changelog && (
              <p className="text-white/40 text-sm text-center max-w-xs">
                {version.changelog}
              </p>
            )}
          </div>
        ) : null}

        {/* Download Button */}
        <button
          onClick={handleDownload}
          disabled={loading || !version}
          className="tv-focusable mt-8 group relative inline-flex items-center gap-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-8 py-4 rounded-2xl transition-all hover:scale-105 shadow-xl shadow-red-900/20"
          tabIndex={0}
        >
          <Download size={24} className="group-hover:animate-bounce" />
          <span className="text-lg">Скачать APK</span>
        </button>

        {/* Instructions */}
        <div className="mt-12 w-full max-w-md">
          <h3 className="text-white/70 font-semibold mb-4 text-center">Как установить:</h3>
          <div className="space-y-3">
            <Step number={1} text="Скачайте APK файл по кнопке выше" />
            <Step number={2} text="В настройках Android TV разрешите установку из неизвестных источников" />
            <Step number={3} text="Откройте скачанный файл и нажмите &quot;Установить&quot;" />
            <Step number={4} text="Запустите AniMira TV и наслаждайтесь просмотром!" />
          </div>
        </div>

        {/* Requirements */}
        <div className="mt-8 flex items-center gap-2 text-white/30 text-sm">
          <CheckCircle size={14} />
          <span>Требуется Android 7.0+ (API 24)</span>
        </div>
      </div>
    </div>
  );
}

function Step({ number, text }: { number: number; text: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-red-600/20 text-red-500 flex items-center justify-center font-bold text-sm">
        {number}
      </div>
      <p className="text-white/70 text-sm leading-relaxed">{text}</p>
    </div>
  );
}
