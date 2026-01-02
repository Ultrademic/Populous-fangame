
export enum SpellType {
  LIGHTNING = 'Lightning',
  EARTHQUAKE = 'Earthquake',
  VOLCANO = 'Volcano',
  SWARM = 'Swarm',
  LANDBRIDGE = 'Landbridge'
}

export type VillagerTask = 'IDLE' | 'MOVING' | 'GATHERING' | 'BUILDING' | 'PRAYING' | 'ENTERING';

export interface VillagerData {
  id: string;
  position: { x: number; y: number; z: number };
  task: VillagerTask;
  targetId?: string;
}

export interface GameState {
  mana: number;
  followers: number;
  maxFollowers: number;
  wood: number;
  shamanAlive: boolean;
  enemiesNearby: number;
  buildingsCount: number;
  currentSpell: SpellType | null;
  logs: string[];
  flagPosition: { x: number; y: number; z: number } | null;
  isPlacingFlag: boolean;
  isPlacingBuilding: boolean;
  selectedVillagerId: string | null;
}

export interface OracleMessage {
  role: 'user' | 'model';
  text: string;
}
