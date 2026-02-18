import ScreenLobby from './components/ScreenLobby';
import ScreenGame from './components/ScreenGame';
import ScreenVote from './components/ScreenVote';
import ScreenResult from './components/ScreenResult';
import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import useGameStore from './store/useGameStore';

function App() {
  const { gameState } = useGameStore();

  // Wake Lock Integration
  useEffect(() => {
    let wakeLock = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
          console.log('Wake Lock is active!');
        }
      } catch (err) {
        console.error(`${err.name}, ${err.message}`);
      }
    };

    // Request on load and whenever visibility changes (screen comes back on)
    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) wakeLock.release();
    };
  }, []);

  const theme = useGameStore((state) => state.theme);

  // Update body class based on theme
  useEffect(() => {
    const root = window.document.documentElement;
    
    // Reset all
    root.classList.remove('dark', 'theme-neon', 'theme-orange');
    
    // Apply new
    if (theme === 'dark') root.classList.add('dark');
    else if (theme === 'neon') root.classList.add('theme-neon');
    else if (theme === 'orange') root.classList.add('theme-orange');
    
  }, [theme]);

  const renderScreen = () => {
      switch (gameState) {
          case 'lobby': return <ScreenLobby key="lobby" />;
          case 'playing': 
          case 'local_reveal':
          case 'discussion':
          case 'discussion_ended': return <ScreenGame key="game" />;
          case 'voting': return <ScreenVote key="voting" />;
          case 'result': return <ScreenResult key="result" />;
          default: return <ScreenLobby key="default" />;
      }
  };

  return (
    <div className="font-sans min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-300">
        <AnimatePresence mode="wait">
            {renderScreen()}
        </AnimatePresence>
    </div>
  );
}

export default App;
