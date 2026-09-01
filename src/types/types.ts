// 核心数据类型定义

export interface MapTile {
  id: string;
  name: string;
  x: number;
  y: number;
  // 昼夜类型
  dayType: string;
  nightType: string;
  color: string;
  // 通用属性
  canStop: boolean;
  canBuild: boolean;
  hasEvent: boolean;
  chargeAtNight: boolean;
  replaceable: boolean;
  replaceList: string[];
  // 夜间专属属性（可覆盖昼间属性）
  nightCanStop?: boolean;       // 夜间是否可停留（undefined=同昼间）
  nightCanBuild?: boolean;      // 夜间是否可建造
  nightHasEvent?: boolean;      // 夜间是否有事件
  // 格子周期变换
  nightGroupId?: string;        // 同组格子共享ID，用于昼夜形态联动
  nightTransformTo?: string;    // 夜间变换目标类型（覆盖nightType作为完整变换）
  transformNote?: string;       // 变换说明文字
}

export interface GameMap {
  id: string;
  project_id: string;
  name: string;
  width: number;
  height: number;
  cyclic: boolean;
  tiles: MapTile[];
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface TileTemplate {
  id: string;
  project_id: string;
  name: string;
  day_type: string;
  night_type: string;
  color: string;
  icon: string;
  can_stop: boolean;
  can_build: boolean;
  has_event: boolean;
  charge_at_night: boolean;
  replaceable: boolean;
  replace_list: string[];
  created_at: string;
}

export interface BuildingTemplate {
  id: string;
  project_id: string;
  type: string;
  level: number;
  cost_wood: number;
  cost_stone: number;
  cost_rice: number;
  effect_day: string;
  effect_night: string;
  can_collect: boolean;
  created_at: string;
}

export interface EventTemplate {
  id: string;
  project_id: string;
  name: string;
  trigger: string;
  condition: Record<string, unknown>;
  actions: EventAction[];
  created_at: string;
}

export interface EventAction {
  type: 'addResource' | 'stealResource' | 'taxCollect' | 'replaceTile' | 'diceBattle';
  resource?: string;
  amount?: number;
  percentage?: number;
  newType?: string;
}

export interface PlayerResources {
  wood: number;
  stone: number;
  rice: number;
}

export interface PlayerBuilding {
  type: string;
  tileId: string;
  tileName: string;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  resources: PlayerResources;
  position: string | null;
  buildings: PlayerBuilding[];
  prosperity: number;
}

export type GamePhase = 'Day' | 'Night';

export interface GameState {
  currentRound: number;
  currentPlayerIndex: number;
  phase: GamePhase;
  turnQueue: string[];
  isNightPhase: boolean;
}

export interface LogEntry {
  id: string;
  round: number;
  player: string;
  action: string;
  details: Record<string, unknown>;
  timestamp: string;
}

export interface GameSession {
  id: string;
  project_id: string;
  map_id: string;
  name: string;
  players: Player[];
  game_state: GameState;
  logs: LogEntry[];
  seed: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export type TriggerType = 'enterTile' | 'nightStart' | 'phaseChange' | 'sameTile';
export type ActionType = 'addResource' | 'stealResource' | 'taxCollect' | 'replaceTile' | 'diceBattle';

export const TILE_TYPE_OPTIONS = [
  'Forest', 'Mine', 'Market', 'Village', 'City', 'Empty',
  'Ruins', 'Bandit', 'NightMarket', 'CollectFee', 'Event', 'Road',
  'Mountain', 'River', 'Desert', 'Lake'
];

export const RESOURCE_TYPES = ['wood', 'stone', 'rice'];

export const PLAYER_COLORS = [
  '#ef4444', '#3b82f6', '#22c55e', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'
];

export const TRIGGER_OPTIONS: { value: TriggerType; label: string }[] = [
  { value: 'enterTile', label: '进入格子时' },
  { value: 'nightStart', label: '夜晚开始时' },
  { value: 'phaseChange', label: '昼夜切换时' },
  { value: 'sameTile', label: '同格玩家' },
];

export const ACTION_OPTIONS: { value: ActionType; label: string }[] = [
  { value: 'addResource', label: '增加资源' },
  { value: 'stealResource', label: '抢夺资源' },
  { value: 'taxCollect', label: '收取税费' },
  { value: 'replaceTile', label: '替换格子' },
  { value: 'diceBattle', label: '骰子战斗' },
];
