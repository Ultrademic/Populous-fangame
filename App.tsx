
import React, { useState, useEffect, useCallback } from 'react';
import GameWorld from './components/GameWorld';
import Oracle from './components/Oracle';
import HUD from './components/HUD';
import { GameState, SpellType } from './types';
import * as THREE from 'three';

const App: React.FC = () => {
  const [gameStarted, setGameStarted] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [gameState, setGameState] = useState<GameState>({
    mana: 250,
    followers: 8,
    wood: 250, // Starting with some wood for testing/intro
    shamanAlive: true,
    enemiesNearby: 4,
    buildingsCount: 0,
    currentSpell: null,
    logs: ["Waiting for your command, Shaman..."],
    flagPosition: null,
    isPlacingFlag: false,
    isPlacingBuilding: false
  });

  // Passive Mana & Growth
  useEffect(() => {
    if (!gameStarted) return;
    
    const timer = setInterval(() => {
      setGameState(prev => ({
        ...prev,
        mana: Math.min(prev.mana + 1 + prev.followers * 0.2, 9999),
        followers: Math.min(prev.followers + 0.01, 200)
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, [gameStarted]);

  const handleStartGame = () => {
    setIsZoomed(true);
    setTimeout(() => {
      setGameStarted(true);
      addLog("The spirits have descended. First, plant the Tribal Flag to establish your base.");
      setGameState(prev => ({ ...prev, isPlacingFlag: true }));
    }, 2000);
  };

  const addLog = useCallback((msg: string) => {
    setGameState(prev => ({
      ...prev,
      logs: [msg, ...prev.logs].slice(0, 10)
    }));
  }, []);

  const handleWoodGathered = useCallback((amount: number) => {
    setGameState(prev => ({
      ...prev,
      wood: prev.wood + amount
    }));
  }, []);

  const handleToggleFlagPlacement = useCallback(() => {
    setGameState(prev => ({ ...prev, isPlacingFlag: !prev.isPlacingFlag, isPlacingBuilding: false }));
  }, []);

  const handleToggleBuildingPlacement = useCallback(() => {
    if (gameState.wood < 200) {
      addLog("Not enough timber for a hut, Shaman.");
      return;
    }
    setGameState(prev => ({ ...prev, isPlacingBuilding: !prev.isPlacingBuilding, isPlacingFlag: false }));
  }, [gameState.wood, addLog]);

  const handleFlagPlaced = useCallback((pos: THREE.Vector3) => {
    setGameState(prev => ({
      ...prev,
      flagPosition: { x: pos.x, y: pos.y, z: pos.z },
      isPlacingFlag: false
    }));
  }, []);

  const handleBuildingPlaced = useCallback((pos: THREE.Vector3) => {
    setGameState(prev => ({
      ...prev,
      wood: prev.wood - 200,
      isPlacingBuilding: false
    }));
    addLog("Blueprint established. Command your followers to build!");
  }, [addLog]);

  const handleHutCompleted = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      buildingsCount: prev.buildingsCount + 1,
      followers: prev.followers + 5 // New buildings attract more followers
    }));
    addLog("A new dwelling stands tall. Our tribe grows stronger.");
  }, [addLog]);

  const handleCastSpell = (spell: SpellType) => {
    if (gameState.mana < 50) return;

    setGameState(prev => {
      let newEnemies = prev.enemiesNearby;
      let newLog = `Casting ${spell}...`;

      if (spell === SpellType.LIGHTNING) {
        newEnemies = Math.max(0, newEnemies - 1);
        newLog = "Bolts from the heavens strike our foes!";
      } else if (spell === SpellType.EARTHQUAKE) {
        newEnemies = Math.max(0, newEnemies - 2);
        newLog = "The earth trembles beneath their feet.";
      }

      return {
        ...prev,
        mana: prev.mana - 50,
        enemiesNearby: newEnemies,
        logs: [newLog, ...prev.logs].slice(0, 10)
      };
    });
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden flex bg-black">
      {/* Background 3D World */}
      <GameWorld 
        isZoomed={isZoomed} 
        onWoodGathered={handleWoodGathered} 
        onLog={addLog}
        isPlacingFlag={gameState.isPlacingFlag}
        isPlacingBuilding={gameState.isPlacingBuilding}
        onFlagPlaced={handleFlagPlaced}
        onBuildingPlaced={handleBuildingPlaced}
        onHutCompleted={handleHutCompleted}
        flagPosition={gameState.flagPosition}
      />

      {/* Splash Screen / Start Overlay */}
      {!gameStarted && (
        <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center transition-opacity duration-1000 ${isZoomed ? 'opacity-0' : 'opacity-100'}`}>
          <div className="p-12 text-center bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl">
            <h1 className="text-6xl font-black italic tracking-tighter text-blue-500 mb-2 animate-pulse">POPULOUS</h1>
            <h2 className="text-xl font-bold tracking-widest text-white/60 mb-8">ORACLE EDITION</h2>
            <p className="text-gray-400 mb-10 max-w-sm mx-auto italic">"Descend from the heavens and lead your people to the promised land."</p>
            <button 
              onClick={handleStartGame}
              className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-full transition-all hover:scale-110 active:scale-95 shadow-[0_0_30px_rgba(37,99,235,0.4)] uppercase tracking-widest border border-blue-400/50"
            >
              Begin Conquest
            </button>
          </div>
        </div>
      )}

      {/* Main Overlay UI - Fades in after game starts */}
      <div className={`absolute inset-0 flex pointer-events-none transition-opacity duration-1000 ${gameStarted ? 'opacity-100' : 'opacity-0'}`}>
        {/* Left Side: Game Status Logs */}
        <div className="flex-1 p-8 flex flex-col justify-start">
          <div className="max-w-md bg-black/40 p-4 rounded-lg backdrop-blur-sm border border-white/5 pointer-events-auto">
             <div className="flex items-center gap-2 mb-2 border-b border-white/10 pb-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_#3b82f6]"></div>
                <h1 className="text-xl font-black italic tracking-tighter text-blue-500">TRIBE INTEL</h1>
             </div>
             <div className="space-y-1 h-32 overflow-y-auto">
               {gameState.logs.map((log, i) => (
                 <p key={i} className={`text-xs ${i === 0 ? 'text-white font-bold' : 'text-gray-500'}`}>
                   {`> ${log}`}
                 </p>
               ))}
             </div>
          </div>
          
          {gameState.isPlacingFlag && (
            <div className="mt-4 bg-yellow-600/20 border border-yellow-500/50 p-3 rounded text-yellow-200 text-sm italic animate-pulse">
              Click anywhere on the terrain to plant your tribal flag.
            </div>
          )}

          {gameState.isPlacingBuilding && (
            <div className="mt-4 bg-amber-600/20 border border-amber-500/50 p-3 rounded text-amber-200 text-sm italic animate-pulse">
              Select a location for the new dwelling.
            </div>
          )}
        </div>

        {/* Right Side: AI Oracle */}
        <div className="pointer-events-auto">
          <Oracle gameState={gameState} />
        </div>
      </div>

      {/* Bottom UI: Spells & Core Stats */}
      <div className={`transition-transform duration-1000 ${gameStarted ? 'translate-y-0' : 'translate-y-full'}`}>
        <HUD 
          state={gameState} 
          onCast={handleCastSpell} 
          onToggleFlagPlacement={handleToggleFlagPlacement}
          onToggleBuildingPlacement={handleToggleBuildingPlacement}
        />
      </div>

      {/* Vignette effect */}
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_150px_rgba(0,0,0,0.8)]"></div>
    </div>
  );
};

export default App;
