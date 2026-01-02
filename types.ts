
export enum SpellType {
  LIGHTNING = 'Lightning',
  EARTHQUAKE = 'Earthquake',
  VOLCANO = 'Volcano',
  SWARM = 'Swarm',
  LANDBRIDGE = 'Landbridge'
}

export type VillagerTask = 'IDLE' | 'MOVING' | 'GATHERING' | 'BUILDING';

export interface VillagerData {
  id: string;
  position: { x: number; y: number; z: number };
  task: VillagerTask;
  targetId?: string;
}

export interface BlueprintData {
  id: string;
  position: { x: number; y: number; z: number };
  progress: number; // 0 to 100
  type: 'HUT';
}

export interface GameState {
  mana: number;
  followers: number;
  wood: number;
  shamanAlive: boolean;
  enemiesNearby: number;
  buildingsCount: number;
  currentSpell: SpellType | null;
  logs: string[];
  flagPosition: { x: number; y: number; z: number } | null;
  isPlacingFlag: boolean;
  isPlacingBuilding: boolean;
}

export interface OracleMessage {
  role: 'user' | 'model';
  text: string;
}
