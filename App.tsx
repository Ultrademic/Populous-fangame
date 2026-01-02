
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
    maxFollowers: 10,
    wood: 250, 
    shamanAlive: true,
    enemiesNearby: 4,
    buildingsCount: 0,
    currentSpell: null,
    logs: ["Waiting for your command, Shaman..."],
    flagPosition: { x: 0, y: 10, z: 0 }, 
    isPlacingFlag: false,
    isPlacingBuilding: false
  });

  useEffect(() => {
    if (!gameStarted) return;
    
    const timer = setInterval(() => {
      setGameState(prev => {
        const prayerBonus = prev.followers * 0.5;
        const buildingBonus = prev.buildingsCount * 3;
        const growthRate = 0.02 + (prev.buildingsCount * 0.01);
        const newFollowers = Math.min(prev.followers + growthRate, prev.maxFollowers);

        return {
          ...prev,
          mana: Math.min(prev.mana + 1 + prayerBonus + buildingBonus, 9999),
          followers: newFollowers
        };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [gameStarted]);

  const addLog = useCallback((msg: string) => {
    setGameState(prev => ({
      ...prev,
      logs: [msg, ...prev.logs].slice(0, 10)
    }));
  }, []);

  const handleStartGame = () => {
    setIsZoomed(true);
    setTimeout(() => {
      setGameStarted(true);
      addLog("The spirits have descended. Our tribe's heart is established.");
    }, 2000);
  };

  const handleCancelAll = useCallback(() => {
    console.log("App: Mode Cancelled (ESC/Right-Click)");
    setGameState(prev => ({
      ...prev,
      isPlacingFlag: false,
      isPlacingBuilding: false,
      currentSpell: null
    }));
  }, []);

  const handleWoodGathered = useCallback((amount: number) => {
    setGameState(prev => ({
      ...prev,
      wood: prev.wood + amount
    }));
  }, []);

  const handleToggleFlagPlacement = useCallback(() => {
    setGameState(prev => {
      const nextMode = !prev.isPlacingFlag;
      return { ...prev, isPlacingFlag: nextMode, isPlacingBuilding: false, currentSpell: null };
    });
  }, []);

  const handleToggleBuildingPlacement = useCallback(() => {
    if (gameState.wood < 200) {
      addLog("Not enough timber for a foundation, Shaman.");
      return;
    }
    setGameState(prev => {
      const nextMode = !prev.isPlacingBuilding;
      return { ...prev, isPlacingBuilding: nextMode, isPlacingFlag: false, currentSpell: null };
    });
  }, [gameState.wood, addLog]);

  const handleFlagPlaced = useCallback((pos: THREE.Vector3) => {
    setGameState(prev => ({
      ...prev,
      flagPosition: { x: pos.x, y: pos.y, z: pos.z },
      isPlacingFlag: false
    }));
    addLog("Tribal flag relocated.");
  }, [addLog]);

  const handleBuildingPlaced = useCallback((pos: THREE.Vector3) => {
    setGameState(prev => ({
      ...prev,
      wood: prev.wood - 200,
      isPlacingBuilding: false
    }));
    addLog("Foundation laid.");
  }, [addLog]);

  const handleHutCompleted = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      buildingsCount: prev.buildingsCount + 1,
      maxFollowers: prev.maxFollowers + 5 
    }));
    addLog("Dwelling completed.");
  }, [addLog]);

  const handleCastSpell = (spell: SpellType) => {
    if (gameState.mana < 50) {
       addLog("Our mana reserves are insufficient.");
       return;
    }
    setGameState(prev => ({
      ...prev,
      currentSpell: spell,
      isPlacingFlag: false,
      isPlacingBuilding: false
    }));
    addLog(`Divine power channeled: ${spell}. Choose a target.`);
  };

  const handleSpellComplete = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      mana: prev.mana - 50,
      currentSpell: null
    }));
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden flex bg-black">
      <GameWorld 
        isZoomed={isZoomed} 
        onWoodGathered={handleWoodGathered} 
        onLog={addLog}
        isPlacingFlag={gameState.isPlacingFlag}
        isPlacingBuilding={gameState.isPlacingBuilding}
        onFlagPlaced={handleFlagPlaced}
        onBuildingPlaced={handleBuildingPlaced}
        onHutCompleted={handleHutCompleted}
        onCancel={handleCancelAll}
        flagPosition={gameState.flagPosition}
        activeSpell={gameState.currentSpell}
        onSpellCastComplete={handleSpellComplete}
      />

      {!gameStarted && (
        <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center transition-opacity duration-1000 ${isZoomed ? 'opacity-0' : 'opacity-100'}`}>
          <div className="p-12 text-center bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl">
            <h1 className="text-6xl font-black italic tracking-tighter text-blue-500 mb-2 animate-pulse">POPULOUS</h1>
            <h2 className="text-xl font-bold tracking-widest text-white/60 mb-8">ORACLE EDITION</h2>
            <button 
              onClick={handleStartGame}
              className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-full transition-all hover:scale-110 active:scale-95 shadow-[0_0_30px_rgba(37,99,235,0.4)] uppercase tracking-widest border border-blue-400/50"
            >
              Begin Conquest
            </button>
          </div>
        </div>
      )}

      <div className={`absolute inset-0 flex pointer-events-none transition-opacity duration-1000 ${gameStarted ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex-1 p-8 flex flex-col justify-start">
          <div className="max-w-md bg-black/40 p-4 rounded-lg backdrop-blur-sm border border-white/5 pointer-events-auto shadow-lg">
             <div className="flex items-center gap-2 mb-2 border-b border-white/10 pb-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_#3b82f6]"></div>
                <h1 className="text-xl font-black italic tracking-tighter text-blue-500">TRIBE INTEL</h1>
             </div>
             <div className="space-y-1 h-32 overflow-y-auto pr-2">
               {gameState.logs.map((log, i) => (
                 <p key={i} className={`text-xs ${i === 0 ? 'text-white font-bold' : 'text-gray-500'}`}>
                   {`> ${log}`}
                 </p>
               ))}
             </div>
          </div>
          
          {(gameState.isPlacingFlag || gameState.isPlacingBuilding || gameState.currentSpell) && (
            <div className="mt-4 bg-blue-600/30 border border-blue-400 p-3 rounded text-blue-100 text-xs italic animate-pulse shadow-lg backdrop-blur-md">
              DIVINE MODE ACTIVE: Click to {gameState.currentSpell ? 'Cast' : 'Place'}, Right-click or ESC to cancel.
            </div>
          )}
        </div>

        <div className="pointer-events-auto">
          <Oracle gameState={gameState} />
        </div>
      </div>

      <div className={`transition-transform duration-1000 ${gameStarted ? 'translate-y-0' : 'translate-y-full'}`}>
        <HUD 
          state={gameState} 
          onCast={handleCastSpell} 
          onToggleFlagPlacement={handleToggleFlagPlacement}
          onToggleBuildingPlacement={handleToggleBuildingPlacement}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_150px_rgba(0,0,0,0.8)]"></div>
    </div>
  );
};

export default App;
