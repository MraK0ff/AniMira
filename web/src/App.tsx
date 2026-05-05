import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';

import Browse from './pages/Browse';
import Search from './pages/Search';
import AnimeDetail from './pages/AnimeDetail';
import Player from './pages/Player';

function App() {
  return (
    <div className="min-h-screen bg-bg-base text-text-main">
      <Navbar />
      
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/search" element={<Search />} />
          <Route path="/anime" element={<AnimeDetail />} />
          <Route path="/player" element={<Player />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
