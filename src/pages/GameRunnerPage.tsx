import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useProject } from '@/contexts/ProjectContext';
import { getMaps, getGameSessions, createGameSession, updateGameSession, appendLog } from '@/lib/api';
import type { GameMap, GameSession, Player, LogEntry, GameState } from '@/types/types';
import { PLAYER_COLORS } from '@/types/types';
import MainLayout from '@/components/layouts/MainLayout';

const TILE_SIZE = 42;

const TILE_COLORS: Record<string, string> = {
  Forest: '#22c55e', Mine: '#78716c', Market: '#f59e0b',
  Village: '#3b82f6', City: '#8b5cf6', Empty: '#374151',
  Ruins: '#9ca3af', Bandit: '#dc2626', NightMarket: '#d97706',
  CollectFee: '#2563eb', Event: '#ec4899', Road: '#6b7280',
  Mountain: '#a16207', River: '#0ea5e9', Desert: '#ca8a04', Lake: '#0284c7',
};

// 夜间专属颜色
const NIGHT_COLORS: Record<string, string> = {
  Forest: '#14532d', Mine: '#292524', Market: '#78350f',
  Village: '#1e3a5f', City: '#3b0764', Empty: '#111827',
  Road: '#1f2937', Mountain: '#451a03', River: '#0c4a6e',
  Desert: '#713f12', Lake: '#0c4a6e', Event: '#831843',
  Ruins: '#374151', Bandit: '#7f1d1d', NightMarket: '#92400e',
  CollectFee: '#1e3a5f',
};

function seededRand(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return Math.abs(s) / 0xffffffff; };
}

export default function GameRunnerPage() {
  const { currentProject, devMode, t } = useProject();
  const [maps, setMaps] = useState<GameMap[]>([]);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [activeSession, setActiveSession] = useState<GameSession | null>(null);
  const [activeMap, setActiveMap] = useState<GameMap | null>(null);
  const [selectedMapId, setSelectedMapId] = useState('');
  const [setupPlayers, setSetupPlayers] = useState<Player[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [phase, setPhase] = useState<'setup' | 'playing'>('setup');
  const [logView, setLogView] = useState<LogEntry[]>([]);
  const logRef = React.useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    if (!currentProject) return;
    const [ms, ss] = await Promise.all([getMaps(currentProject.id), getGameSessions(currentProject.id)]);
    setMaps(ms);
    setSessions(ss);
    if (ms.length > 0) setSelectedMapId(ms[0].id);
  }, [currentProject]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (activeSession) {
      setLogView(activeSession.logs);
      const map = maps.find(m => m.id === activeSession.map_id);
      if (map) setActiveMap(map);
      setTimeout(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' }); }, 50);
    }
  }, [activeSession, maps]);

  const addPlayer = () => {
    if (!newPlayerName.trim()) return;
    if (setupPlayers.length >= 6) { toast.error(t('runner.max_players')); return; }
    const p: Player = {
      id: `P${setupPlayers.length + 1}`,
      name: newPlayerName.trim(),
      color: PLAYER_COLORS[setupPlayers.length],
      resources: { wood: 2, stone: 1, rice: 2 },
      position: null,
      buildings: [],
      prosperity: 0,
    };
    setSetupPlayers(prev => [...prev, p]);
    setNewPlayerName('');
  };

  const removePlayer = (id: string) => setSetupPlayers(prev => prev.filter(p => p.id !== id));

  const startGame = async () => {
    if (!currentProject) { toast.error(t('runner.select_project_first')); return; }
    if (!selectedMapId) { toast.error(t('runner.select_map')); return; }
    if (setupPlayers.length < 1) { toast.error(t('runner.min_players')); return; }
    const seed = Math.floor(Math.random() * 999999);
    try {
      const session = await createGameSession(currentProject.id, selectedMapId, setupPlayers, seed);
      setSessions(prev => [session, ...prev]);
      setActiveSession(session);
      const map = maps.find(m => m.id === selectedMapId)!;
      setActiveMap(map);
      setPhase('playing');
      toast.success(t('runner.game_started'));
    } catch { toast.error(t('runner.create_failed')); }
  };

  const loadSession = (session: GameSession) => {
    setActiveSession(session);
    setPhase('playing');
    setLogView(session.logs);
  };

  const currentPlayer = activeSession
    ? activeSession.players[activeSession.game_state.currentPlayerIndex]
    : null;

  const isNightPhase = activeSession?.game_state.phase === 'Night';

  const handleTileClick = async (tileId: string) => {
    if (!activeSession || !activeMap || !currentPlayer) return;

    const tile = activeMap.tiles.find(t => t.id === tileId);
    if (!tile) return;

    // 夜间：检查夜间专属canStop（nightCanStop覆盖，否则继承dayType的canStop）
    const effectiveCanStop = isNightPhase
      ? (tile.nightCanStop !== undefined ? tile.nightCanStop : tile.canStop)
      : tile.canStop;
    if (!effectiveCanStop) { toast.error(t('runner.cannot_stop')); return; }

    // 夜间：使用nightTransformTo或nightType作为活跃类型计算效果
    const activeType = isNightPhase
      ? (tile.nightTransformTo || tile.nightType)
      : tile.dayType;

    const updatedPlayers = activeSession.players.map(p =>
      p.id === currentPlayer.id ? { ...p, position: tileId } : p
    );

    // Apply tile effects based on active type
    let newResources = { ...currentPlayer.resources };
    const effectLog: string[] = [];

    if (activeType === 'Forest') { newResources.wood += 1; effectLog.push(t('runner.gain_wood')); }
    if (activeType === 'Mine') { newResources.stone += 1; effectLog.push(t('runner.gain_stone')); }
    if (activeType === 'Market') { newResources.rice += 1; effectLog.push(t('runner.gain_rice')); }
    if (activeType === 'NightMarket' && isNightPhase) { newResources.rice += 2; effectLog.push(t('runner.night_market_gain')); }
    if (activeType === 'Bandit' && isNightPhase) {
      const loss = Math.floor(newResources.wood / 3) || 0;
      newResources.wood = Math.max(0, newResources.wood - loss);
      if (loss > 0) effectLog.push(t('runner.bandit_loss').replace('{n}', String(loss)));
    }
    if (tile.chargeAtNight && isNightPhase) {
      const fee = 1;
      newResources.rice = Math.max(0, newResources.rice - fee);
      effectLog.push(t('runner.night_fee').replace('{n}', String(fee)));
    }

    // Check encounter
    const sameCell = activeSession.players.filter(p => p.id !== currentPlayer.id && p.position === tileId);
    if (sameCell.length > 0) {
      effectLog.push(`${t('runner.encounter')}${sameCell.map(p => p.name).join(',')}`);
    }

    const finalPlayers = updatedPlayers.map(p =>
      p.id === currentPlayer.id ? { ...p, resources: newResources } : p
    );

    const gs = activeSession.game_state;
    const nextLogs = await appendLog(activeSession.id, activeSession.logs, {
      round: gs.currentRound,
      player: currentPlayer.name,
      action: isNightPhase ? 'night_move' : 'move',
      details: { from: currentPlayer.position, to: tileId, tile: tile.name, phase: gs.phase, effects: effectLog },
    });

    setLogView(nextLogs);
    setActiveSession(prev => prev ? { ...prev, players: finalPlayers, logs: nextLogs } : prev);
    await updateGameSession(activeSession.id, { players: finalPlayers });

    if (effectLog.length) toast.success(`${tile.name}: ${effectLog.join(', ')}`);
    setTimeout(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' }); }, 50);
  };

  const handleEndTurn = async () => {
    if (!activeSession) return;
    const gs = activeSession.game_state;
    const queueLen = gs.turnQueue.length;
    const nextIndex = (gs.currentPlayerIndex + 1) % queueLen;
    const nextItem = gs.turnQueue[nextIndex];
    const isNextNight = nextItem === 'Night';

    let newPhase = gs.phase;
    let newRound = gs.currentRound;
    let newPlayerIdx = nextIndex;
    let updatedPlayers = [...activeSession.players];

    if (isNextNight) {
      newPhase = 'Night';
      // Execute night effects
      const rand = seededRand(activeSession.seed + activeSession.logs.length);
      updatedPlayers = activeSession.players.map(p => {
        const pos = p.position;
        if (!pos) return p;
        const tile = activeMap?.tiles.find(t => t.id === pos);
        if (!tile) return p;
        if (tile.chargeAtNight) {
          const fee = Math.floor((p.resources.wood + p.resources.stone + p.resources.rice) * 0.1) || 0;
          return { ...p, resources: { ...p.resources, wood: Math.max(0, p.resources.wood - fee) } };
        }
        return p;
      });
    } else if (gs.phase === 'Night' && nextIndex === 0) {
      newPhase = 'Day';
      newRound += 1;
      toast.success(t('runner.game_started'));
    }

    const newState: GameState = {
      ...gs,
      currentPlayerIndex: isNextNight ? -1 : nextIndex,
      phase: newPhase,
      currentRound: newRound,
      isNightPhase: isNextNight,
    };

    const nextLogs = await appendLog(activeSession.id, activeSession.logs, {
      round: gs.currentRound,
      player: isNextNight ? 'SYSTEM' : activeSession.players[nextIndex]?.name || 'SYSTEM',
      action: isNextNight ? 'night_start' : 'turn_end',
      details: { phase: newPhase, round: newRound },
    });

    setLogView(nextLogs);
    setActiveSession(prev => prev ? { ...prev, game_state: newState, players: updatedPlayers, logs: nextLogs } : prev);
    await updateGameSession(activeSession.id, { game_state: newState, players: updatedPlayers });

    if (isNextNight) {
      toast(t('runner.night_descends'), { icon: '🌙' });
    }
    setTimeout(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' }); }, 50);
  };

  const handleEndNight = async () => {
    if (!activeSession) return;
    const gs = activeSession.game_state;
    const newState: GameState = {
      ...gs,
      currentPlayerIndex: 0,
      phase: 'Day',
      currentRound: gs.currentRound + 1,
      isNightPhase: false,
    };
    const nextLogs = await appendLog(activeSession.id, activeSession.logs, {
      round: gs.currentRound,
      player: 'SYSTEM',
      action: 'day_start',
      details: { round: newState.currentRound },
    });
    setLogView(nextLogs);
    setActiveSession(prev => prev ? { ...prev, game_state: newState, logs: nextLogs } : prev);
    await updateGameSession(activeSession.id, { game_state: newState });
    toast.success(`☀ ${t('runner.day_begins').replace('{round}', String(newState.currentRound))}`, { icon: '☀' });
    setTimeout(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' }); }, 50);
  };

  const handleSaveGame = async () => {
    if (!activeSession) return;
    const blob = new Blob([JSON.stringify(activeSession, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `savefile_${activeSession.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('runner.save_downloaded'));
  };

  if (!currentProject) {
    return (
      <MainLayout>
        <div className="flex-1 flex items-center justify-center">
          <div className="pixel-card p-6 text-center text-muted-foreground text-xs uppercase">{t('runner.select_project_first')}</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Top bar */}
        <div className="pixel-card border-b-2 border-border p-2 flex items-center gap-3 shrink-0 flex-wrap">
          <span className="text-accent font-bold text-xs uppercase">{t('runner.title')}</span>
          {activeSession && (
            <>
              <div className={`text-xs font-bold uppercase px-2 py-0.5 border-2 ${isNightPhase ? 'border-accent text-accent' : 'border-primary text-primary'}`}>
                {isNightPhase ? t('runner.night_phase') : t('runner.day_phase')}
              </div>
              <span className="text-muted-foreground text-[10px]">{t('runner.round')} {activeSession.game_state.currentRound} {t('common.round')}</span>
              {currentPlayer && (
                <span className="text-xs font-bold" style={{ color: currentPlayer.color }}>▶ {currentPlayer.name}{t('runner.current_player')}</span>
              )}
              <div className="flex-1" />
              {devMode && <span className="text-accent text-[10px] uppercase font-bold pixel-blink">DEV</span>}
              {!isNightPhase && <button className="pixel-btn bg-primary text-primary-foreground text-[10px] font-bold uppercase px-2 py-1" onClick={handleEndTurn}>{t('runner.end_turn')}</button>}
              {isNightPhase && <button className="pixel-btn bg-accent text-accent-foreground text-[10px] font-bold uppercase px-2 py-1" onClick={handleEndNight}>{t('runner.end_night')}</button>}
              <button className="pixel-btn bg-secondary text-secondary-foreground text-[10px] font-bold uppercase px-2 py-1" onClick={handleSaveGame}>{t('runner.save_game')}</button>
              <button className="pixel-btn bg-secondary text-secondary-foreground text-[10px] font-bold uppercase px-2 py-1" onClick={() => setPhase('setup')}>{t('runner.new_game')}</button>
            </>
          )}
        </div>

        {phase === 'setup' ? (
          /* Setup screen */
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            <div className="pixel-card p-4">
              <div className="text-accent text-xs uppercase font-bold mb-3">{t('runner.select_map_title')}</div>
              <select
                className="pixel-inset bg-input text-foreground text-xs px-3 py-2 w-full max-w-xs focus:outline-none"
                value={selectedMapId}
                onChange={e => setSelectedMapId(e.target.value)}
              >
                {maps.map(m => <option key={m.id} value={m.id}>{m.name} ({m.width}×{m.height})</option>)}
              </select>
            </div>

            <div className="pixel-card p-4">
              <div className="text-accent text-xs uppercase font-bold mb-3">{t('runner.add_player_title')}</div>
              <div className="flex gap-2 mb-3">
                <input
                  className="pixel-inset bg-input text-foreground text-xs px-3 py-2 flex-1 max-w-xs focus:outline-none"
                  placeholder={t('runner.player_name_ph')}
                  value={newPlayerName}
                  onChange={e => setNewPlayerName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addPlayer()}
                />
                <button className="pixel-btn bg-primary text-primary-foreground text-xs font-bold uppercase px-3 py-2" onClick={addPlayer}>{t('runner.add_player_btn')}</button>
              </div>
              <div className="flex flex-col gap-1">
                {setupPlayers.map(p => (
                  <div key={p.id} className="flex items-center gap-2 p-2 bg-secondary/20 border border-border">
                    <div className="w-3 h-3 border border-border" style={{ backgroundColor: p.color }} />
                    <span className="text-xs font-bold">{p.id}: {p.name}</span>
                    <button className="text-destructive text-[10px] ml-auto font-bold" onClick={() => removePlayer(p.id)}>✕</button>
                  </div>
                ))}
              </div>
            </div>

            <button
              className="pixel-btn bg-primary text-primary-foreground font-bold uppercase text-sm px-6 py-3 self-start"
              onClick={startGame}
              disabled={setupPlayers.length < 1}
            >
              ▶ {t('runner.start_game')}
            </button>

            {/* Previous sessions */}
            {sessions.length > 0 && (
              <div className="pixel-card p-4">
                <div className="text-accent text-xs uppercase font-bold mb-3">{t('runner.history_games')}</div>
                <div className="flex flex-col gap-1">
                  {sessions.slice(0, 5).map(s => (
                    <div key={s.id} className="flex items-center gap-2 p-2 bg-secondary/20 border border-border">
                      <span className="text-xs flex-1 truncate">{s.name}</span>
                      <span className="text-[10px] text-muted-foreground">{s.players.length}{t('runner.players_unit', '人')} · {t('runner.round')}{s.game_state.currentRound}{t('common.round')}</span>
                      <button className="pixel-btn bg-accent text-accent-foreground text-[10px] font-bold px-2 py-0.5" onClick={() => loadSession(s)}>{t('runner.continue_btn')}</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : activeSession && activeMap ? (
          /* Playing screen */
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left sidebar */}
            <div className="w-44 shrink-0 bg-sidebar border-r-2 border-sidebar-border flex flex-col overflow-y-auto">
              <div className="p-2 border-b border-sidebar-border">
                <div className="text-accent text-[10px] uppercase font-bold mb-1">{t('runner.turn_queue')}</div>
                {activeSession.game_state.turnQueue.map((id, i) => {
                  const p = activeSession.players.find(p => p.id === id);
                  const isCurrent = activeSession.game_state.phase === 'Day' && i === activeSession.game_state.currentPlayerIndex;
                  return (
                    <div key={id} className={`text-[10px] py-0.5 ${isCurrent ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                      {isCurrent ? '▶ ' : '  '}{id === 'Night' ? t('runner.night_phase') : p?.name || id}
                    </div>
                  );
                })}
              </div>
              {/* Players */}
              {activeSession.players.map(p => (
                <div key={p.id} className={`p-2 border-b border-sidebar-border/50 ${currentPlayer?.id === p.id && !isNightPhase ? 'bg-sidebar-accent' : ''}`}>
                  <div className="flex items-center gap-1 mb-1">
                    <div className="w-2 h-2" style={{ backgroundColor: p.color }} />
                    <span className="text-[11px] font-bold truncate" style={{ color: p.color }}>{p.name}</span>
                    <span className="text-[9px] text-muted-foreground ml-auto">⭐{p.prosperity}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground grid grid-cols-3 gap-0.5">
                    <span>{t('runner.wood_unit')}:{p.resources.wood}</span>
                    <span>{t('runner.stone_unit')}:{p.resources.stone}</span>
                    <span>{t('runner.rice_unit')}:{p.resources.rice}</span>
                  </div>
                  {p.buildings.length > 0 && (
                    <div className="text-[9px] text-muted-foreground mt-1">
                      {p.buildings.map((b, i) => <span key={i}>{b.type} </span>)}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Center: map */}
            <div className="flex-1 min-w-0 overflow-auto bg-background p-3 relative">
              {isNightPhase && (
                <div className="night-overlay absolute inset-0 pointer-events-none z-10 opacity-60" />
              )}
              <div style={{ display: 'inline-block' }}>
                {Array.from({ length: activeMap.height }, (_, y) => (
                  <div key={y} style={{ display: 'flex' }}>
                    {Array.from({ length: activeMap.width }, (_, x) => {
                      const tile = activeMap.tiles.find(t => t.x === x && t.y === y);
                      if (!tile) return (
                        <div key={`${x}-${y}`} style={{ width: TILE_SIZE, height: TILE_SIZE, border: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }} />
                      );
                      const tileType = isNightPhase ? (tile.nightTransformTo || tile.nightType) : tile.dayType;
                      const color = isNightPhase
                        ? (NIGHT_COLORS[tileType] || '#1a1a2e')
                        : (TILE_COLORS[tileType] || '#374151');
                      const playersHere = activeSession.players.filter(p => p.position === tile.id);
                      const effectiveCanStop = isNightPhase
                        ? (tile.nightCanStop !== undefined ? tile.nightCanStop : tile.canStop)
                        : tile.canStop;
                      return (
                        <div
                          key={`${x}-${y}`}
                          className="tile-hover"
                          onClick={() => handleTileClick(tile.id)}
                          style={{
                            width: TILE_SIZE, height: TILE_SIZE,
                            backgroundColor: color,
                            border: isNightPhase ? '2px solid rgba(100,100,200,0.4)' : '2px solid rgba(0,0,0,0.5)',
                            boxShadow: isNightPhase
                              ? 'inset 2px 2px 0 rgba(100,100,200,0.2), inset -1px -1px 0 rgba(0,0,0,0.6)'
                              : 'inset 2px 2px 0 rgba(255,255,255,0.15), inset -1px -1px 0 rgba(0,0,0,0.4)',
                            position: 'relative', flexShrink: 0,
                            cursor: effectiveCanStop ? 'pointer' : 'not-allowed',
                            opacity: effectiveCanStop ? 1 : 0.6,
                          }}
                          title={`${tile.name} (${tileType})${!effectiveCanStop ? ` — ${t('runner.cannot_stop')}` : ''}`}
                        >
                          {/* Player dots */}
                          <div style={{ position: 'absolute', top: 2, right: 2, display: 'flex', gap: 1 }}>
                            {playersHere.map(p => (
                              <div key={p.id} style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: p.color, border: '1px solid rgba(0,0,0,0.5)' }} />
                            ))}
                          </div>
                          <div style={{ position: 'absolute', bottom: 1, left: 1, fontSize: 8, color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace', lineHeight: 1, maxWidth: TILE_SIZE - 4, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {tile.name}
                          </div>
                          {tile.chargeAtNight && isNightPhase && <div style={{ position: 'absolute', top: 2, left: 2, fontSize: 8, color: '#fbbf24' }}>¥</div>}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="mt-2 text-muted-foreground text-[10px]">
                {isNightPhase ? t('runner.move_hint_night') : t('runner.move_hint_day')}
              </div>
            </div>

            {/* Right: log */}
            <div className="w-52 shrink-0 bg-sidebar border-l-2 border-sidebar-border flex flex-col">
              <div className="p-2 border-b border-sidebar-border text-accent text-[10px] uppercase font-bold">{t('runner.log')}</div>
              <div ref={logRef} className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
                {logView.map((log, i) => {
                  const effects = Array.isArray(log.details?.effects) ? (log.details.effects as string[]) : [];
                  return (
                    <div key={log.id || i} className="text-[9px] border-b border-border/30 pb-0.5">
                      <span className="text-muted-foreground">R{log.round}</span>
                      <span className="text-accent ml-1">[{log.player}]</span>
                      <span className="text-foreground ml-1">{log.action}</span>
                      {effects.length > 0 && (
                        <span className="text-primary ml-1">{effects.join(' ')}</span>
                      )}
                    </div>
                  );
                })}
                {logView.length === 0 && <div className="text-muted-foreground text-[10px] text-center mt-4">{t('runner.no_logs')}</div>}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </MainLayout>
  );
}
