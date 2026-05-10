import { memo, useCallback } from 'react';

interface ProgressBarProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  formatTime: (seconds: number) => string;
  accentColor?: string;
}

function ProgressBarInternal({
  currentTime,
  duration,
  onSeek,
  formatTime,
  accentColor = '#6b7280', // gray-500 default
}: ProgressBarProps) {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSeek(Number(e.target.value));
  }, [onSeek]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 w-full">
      <span className="text-white/80 text-sm font-medium min-w-[50px]">
        {formatTime(currentTime)}
      </span>

      <div className="flex-1 relative group">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleChange}
          className="w-full h-1.5 bg-white/30 rounded-full appearance-none cursor-pointer hover:h-2 transition-all"
          style={{
            accentColor,
            background: `linear-gradient(to right, ${accentColor} ${progress}%, rgba(255,255,255,0.3) ${progress}%)`
          }}
        />
      </div>

      <span className="text-white/80 text-sm font-medium min-w-[50px] text-right">
        {formatTime(duration)}
      </span>
    </div>
  );
}

export const ProgressBar = memo(ProgressBarInternal);
export default ProgressBar;
