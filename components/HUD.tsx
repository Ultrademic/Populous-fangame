
import React from 'react';
import { GameState, SpellType } from '../types';

interface HUDProps {
  state: GameState;
  onCast: (spell: SpellType) => void;
  onToggleFlagPlacement: () => void;
  onToggleBuildingPlacement: () => void;
}

const HUD: React.FC<HUDProps> = ({ state, onCast, onToggleFlagPlacement, onToggleBuildingPlacement }) => {
  const spells = Object.values(SpellType);

  return (
    <div className="absolute inset-x-0 bottom-0 p-6 flex justify-between items-end pointer-events-none">
      {/* Stats Bar */}
      <div className="bg-black/60 backdrop-blur-md p-4 rounded-xl border border-white/10 pointer-events-auto shadow-xl flex items-center gap-6">
        <div className="flex gap-8">
          <StatItem label="Mana" value={Math.floor(state.mana)} color="text-blue-400" />
          <StatItem label="Wood" value={Math.floor(state.wood)} color="text-amber-600" />
          <StatItem label="Villagers" value={Math.floor(state.followers)} color="text-green-400" />
        </div>
        
        <div className="h-10 w-px bg-white/10 mx-2"></div>

        <div className="flex gap-2">
          <button 
            onClick={onToggleFlagPlacement}
            className={`px-4 py-2 rounded-lg font-bold text-xs uppercase transition-all border-2 ${
              state.isPlacingFlag 
                ? 'bg-red-500 border-red-400 text-white animate-pulse' 
                : 'bg-blue-600/80 border-blue-400 text-blue-100 hover:bg-blue-500'
            }`}
          >
            {state.isPlacingFlag ? 'Cancel' : 'Flag'}
          </button>

          <button 
            onClick={onToggleBuildingPlacement}
            disabled={state.wood < 200}
            className={`px-4 py-2 rounded-lg font-bold text-xs uppercase transition-all border-2 ${
              state.isPlacingBuilding 
                ? 'bg-amber-500 border-amber-400 text-white animate-pulse' 
                : state.wood < 200 
                  ? 'bg-gray-800 border-transparent text-gray-500 opacity-50 cursor-not-allowed'
                  : 'bg-amber-600/80 border-amber-400 text-amber-100 hover:bg-amber-500 shadow-[0_0_10px_rgba(217,119,6,0.2)]'
            }`}
          >
            Build Hut (200W)
          </button>
        </div>
      </div>

      {/* Spell Bar */}
      <div className="flex gap-2 pointer-events-auto">
        {spells.map(spell => (
          <button
            key={spell}
            onClick={() => onCast(spell)}
            disabled={state.mana < 50}
            className={`
              w-16 h-16 flex flex-col items-center justify-center rounded-lg border-2 transition-all group
              ${state.mana < 50 
                ? 'opacity-30 grayscale cursor-not-allowed border-transparent bg-gray-800' 
                : 'border-white/20 bg-black/60 hover:border-yellow-500 hover:scale-105'}
            `}
          >
            <div className="text-[10px] uppercase font-bold text-gray-400 group-hover:text-yellow-500 mb-1">{spell[0]}</div>
            <div className="text-[8px] text-blue-400 font-mono">50M</div>
          </button>
        ))}
      </div>
    </div>
  );
};

const StatItem = ({ label, value, color }: { label: string, value: number, color: string }) => (
  <div className="flex flex-col">
    <span className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">{label}</span>
    <span className={`text-2xl font-black ${color}`}>{value}</span>
  </div>
);

export default HUD;
