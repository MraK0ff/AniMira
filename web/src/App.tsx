import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Search from './pages/Search';
import AnimeDetail from './pages/AnimeDetail';
import Player from './pages/Player';
import Download from './pages/Download';
import ShikimoriSearch from './pages/ShikimoriSearch';
import { useTVNavigation } from './hooks/useTVNavigation';

function TVNavigationWrapper({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isTVMode, setIsTVMode] = useState(false);

  const { containerRef } = useTVNavigation({
    onBack: () => {
      if (location.pathname !== '/') {
        navigate(-1);
      }
    },
  });

  useEffect(() => {
    const detectTV = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        setIsTVMode(true);
        document.body.classList.add('tv-mode');
      }
    };
    window.addEventListener('keydown', detectTV);
    return () => window.removeEventListener('keydown', detectTV);
  }, []);

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className={isTVMode ? 'tv-mode' : ''}>
      {children}
    </div>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-bg-base text-text-main">
      <TVNavigationWrapper>
        <Navbar />
      
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/shikimori" element={<ShikimoriSearch />} />
          <Route path="/anime" element={<AnimeDetail />} />
          <Route path="/player" element={<Player />} />
          <Route path="/download" element={<Download />} />
        </Routes>
      </main>
      </TVNavigationWrapper>
    </div>
  );
}

export default App;
