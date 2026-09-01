import { supabase } from '@/db/supabase';
import type {
  Project, GameMap, TileTemplate, BuildingTemplate,
  EventTemplate, GameSession, Player, LogEntry, GameState
} from '@/types/types';

// ── Projects ──────────────────────────────────────────────────────────────────
export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function createProject(name: string, description = ''): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert({ name, description })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data!;
}

export async function updateProject(id: string, updates: Partial<Pick<Project, 'name' | 'description'>>): Promise<void> {
  const { error } = await supabase.from('projects').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}

// ── Maps ──────────────────────────────────────────────────────────────────────
export async function getMaps(projectId: string): Promise<GameMap[]> {
  const { data, error } = await supabase
    .from('maps')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function createMap(projectId: string, name = '未命名地图'): Promise<GameMap> {
  const { data, error } = await supabase
    .from('maps')
    .insert({ project_id: projectId, name, width: 8, height: 6, tiles: [] })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data!;
}

export async function updateMap(id: string, updates: Partial<GameMap>): Promise<void> {
  const { error } = await supabase.from('maps').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteMap(id: string): Promise<void> {
  const { error } = await supabase.from('maps').delete().eq('id', id);
  if (error) throw error;
}

export async function getMap(id: string): Promise<GameMap | null> {
  const { data, error } = await supabase
    .from('maps').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

// ── Tile Templates ─────────────────────────────────────────────────────────────
export async function getTileTemplates(projectId: string): Promise<TileTemplate[]> {
  const { data, error } = await supabase
    .from('tile_templates')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function createTileTemplate(template: Omit<TileTemplate, 'id' | 'created_at'>): Promise<TileTemplate> {
  const { data, error } = await supabase
    .from('tile_templates').insert(template).select().maybeSingle();
  if (error) throw error;
  return data!;
}

export async function updateTileTemplate(id: string, updates: Partial<TileTemplate>): Promise<void> {
  const { error } = await supabase.from('tile_templates').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteTileTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('tile_templates').delete().eq('id', id);
  if (error) throw error;
}

// ── Building Templates ─────────────────────────────────────────────────────────
export async function getBuildingTemplates(projectId: string): Promise<BuildingTemplate[]> {
  const { data, error } = await supabase
    .from('building_templates')
    .select('*')
    .eq('project_id', projectId)
    .order('level', { ascending: true })
    .limit(100);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function createBuildingTemplate(template: Omit<BuildingTemplate, 'id' | 'created_at'>): Promise<BuildingTemplate> {
  const { data, error } = await supabase
    .from('building_templates').insert(template).select().maybeSingle();
  if (error) throw error;
  return data!;
}

export async function updateBuildingTemplate(id: string, updates: Partial<BuildingTemplate>): Promise<void> {
  const { error } = await supabase.from('building_templates').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteBuildingTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('building_templates').delete().eq('id', id);
  if (error) throw error;
}

// ── Event Templates ─────────────────────────────────────────────────────────────
export async function getEventTemplates(projectId: string): Promise<EventTemplate[]> {
  const { data, error } = await supabase
    .from('event_templates')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function createEventTemplate(template: Omit<EventTemplate, 'id' | 'created_at'>): Promise<EventTemplate> {
  const { data, error } = await supabase
    .from('event_templates').insert(template).select().maybeSingle();
  if (error) throw error;
  return data!;
}

export async function updateEventTemplate(id: string, updates: Partial<EventTemplate>): Promise<void> {
  const { error } = await supabase.from('event_templates').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteEventTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('event_templates').delete().eq('id', id);
  if (error) throw error;
}

// ── Game Sessions ───────────────────────────────────────────────────────────────
export async function getGameSessions(projectId: string): Promise<GameSession[]> {
  const { data, error } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function createGameSession(
  projectId: string,
  mapId: string,
  players: Player[],
  seed: number
): Promise<GameSession> {
  const initialState: GameState = {
    currentRound: 1,
    currentPlayerIndex: 0,
    phase: 'Day',
    turnQueue: [...players.map(p => p.id), 'Night'],
    isNightPhase: false,
  };
  const { data, error } = await supabase
    .from('game_sessions')
    .insert({
      project_id: projectId,
      map_id: mapId,
      name: `游戏 - ${new Date().toLocaleString('zh-CN')}`,
      players,
      game_state: initialState,
      logs: [],
      seed,
      status: 'active',
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data!;
}

export async function updateGameSession(
  id: string,
  updates: Partial<Pick<GameSession, 'players' | 'game_state' | 'logs' | 'status'>>
): Promise<void> {
  const { error } = await supabase.from('game_sessions').update(updates).eq('id', id);
  if (error) throw error;
}

export async function getGameSession(id: string): Promise<GameSession | null> {
  const { data, error } = await supabase
    .from('game_sessions').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function appendLog(sessionId: string, existingLogs: LogEntry[], newEntry: Omit<LogEntry, 'id' | 'timestamp'>): Promise<LogEntry[]> {
  const entry: LogEntry = {
    ...newEntry,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  const updated = [...existingLogs, entry];
  await updateGameSession(sessionId, { logs: updated });
  return updated;
}
