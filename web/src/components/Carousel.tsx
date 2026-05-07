import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  title: string;
  children: React.ReactNode;
}

export default function Carousel({ title, children }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { clientWidth } = scrollRef.current;
      const scrollAmount = direction === 'left' ? -clientWidth + 100 : clientWidth - 100;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative group mb-8 md:mb-10">
      <h2 className="text-lg md:text-2xl font-bold text-white mb-3 md:mb-4 px-4 md:px-6 lg:px-12 truncate">{title}</h2>
      
      <div className="relative">
        {/* Left Button - visible on hover for desktop, always on mobile */}
        <button 
          onClick={() => scroll('left')}
          className="absolute left-0 top-0 bottom-0 w-10 md:w-12 z-20 flex items-center justify-center bg-gradient-to-r from-bg-base to-transparent opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity active:scale-95"
          aria-label="Scroll left"
        >
          <ChevronLeft size={32} className="text-white hover:scale-110 transition-transform md:w-9 md:h-9" />
        </button>

        {/* Scroll Container */}
        <div 
          ref={scrollRef}
          className="flex gap-3 md:gap-4 overflow-x-auto hide-scrollbar px-4 md:px-6 lg:px-12 pb-4 scroll-smooth snap-x snap-mandatory"
        >
          {children}
        </div>

        {/* Right Button - visible on hover for desktop, always on mobile */}
        <button 
          onClick={() => scroll('right')}
          className="absolute right-0 top-0 bottom-0 w-10 md:w-12 z-20 flex items-center justify-center bg-gradient-to-l from-bg-base to-transparent opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity active:scale-95"
          aria-label="Scroll right"
        >
          <ChevronRight size={32} className="text-white hover:scale-110 transition-transform md:w-9 md:h-9" />
        </button>
      </div>
    </div>
  );
}
