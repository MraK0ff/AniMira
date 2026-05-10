import { memo } from 'react';
import { Settings, X } from 'lucide-react';
import clsx from 'clsx';

interface Quality {
  name: string;
  url: string;
}

interface QualitySelectorProps {
  isOpen: boolean;
  qualities: Quality[];
  activeUrl: string;
  onClose: () => void;
  onSelect: (url: string) => void;
}

function QualitySelectorInternal({
  isOpen,
  qualities,
  activeUrl,
  onClose,
  onSelect,
}: QualitySelectorProps) {
  if (!isOpen || qualities.length <= 1) return null;

  const activeQuality = qualities.find(q => q.url === activeUrl);

  return (
    <div className="absolute bottom-full left-0 mb-2 w-40 bg-black/95 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl overflow-hidden z-30 animate-slide-in-bottom">
      {/* Header */}
      <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between bg-white/5">
        <div className="flex items-center gap-2">
          <Settings size={14} className="text-white/70" />
          <span className="text-white/90 text-xs font-bold uppercase">Качество</span>
        </div>
        <button
          onClick={onClose}
          tabIndex={0}
          className="tv-focusable w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <X size={12} className="text-white/70" />
        </button>
      </div>

      {/* Quality List */}
      <div className="p-1 space-y-0.5 max-h-48 overflow-y-auto scrollbar-thin">
        {qualities.map((q) => (
          <button
            key={q.url}
            onClick={() => onSelect(q.url)}
            tabIndex={0}
            className={clsx(
              'tv-focusable w-full text-left px-3 py-2.5 text-sm rounded-lg transition-all',
              activeUrl === q.url
                ? 'bg-primary/30 text-white border border-primary/50'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{q.name}</span>
              {activeUrl === q.url && (
                <span className="w-2 h-2 rounded-full bg-primary" />
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 bg-white/5 border-t border-white/10 text-center">
        <span className="text-[10px] text-white/40">{qualities.length} доступно</span>
      </div>
    </div>
  );
}

export const QualitySelector = memo(QualitySelectorInternal);
export default QualitySelector;
