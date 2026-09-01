import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { GameSession, LogEntry } from '@/types/types';
import { useProject } from '@/contexts/ProjectContext';
import MainLayout from '@/components/layouts/MainLayout';

const TILE_COLORS: Record<string, string> = {
  Forest: '#22c55e', Mine: '#78716c', Market: '#f59e0b',
  Village: '#3b82f6', City: '#8b5cf6', Empty: '#374151',
  Ruins: '#9ca3af', Bandit: '#dc2626', NightMarket: '#d97706',
  CollectFee: '#2563eb', Event: '#ec4899',
};

export default function ReplayPage() {
  const { t } = useProject();
  const [session, setSession] = useState<GameSession | null>(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1000);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string) as GameSession;
        if (!data.logs || !data.players) throw new Error('invalid');
        setSession(data);
        setStep(0);
        setPlaying(false);
        toast.success(t('runner.save_loaded') + ' · ' + data.logs.length + ' ' + t('replay.log'));
      } catch { toast.error(t('replay.invalid', '存档格式错误')); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  useEffect(() => {
    if (!playing || !session) return;
    intervalRef.current = setInterval(() => {
      setStep(prev => {
        if (prev >= session.logs.length - 1) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, speed);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, session, speed]);

  const currentLogs = session?.logs.slice(0, step + 1) ?? [];
  const currentLog = session?.logs[step];
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [step]);

  // Reconstruct player states up to current step
  const reconstructPlayers = () => {
    if (!session) return [];
    const players = JSON.parse(JSON.stringify(session.players)) as typeof session.players;
    // Reset to initial state
    players.forEach(p => { p.position = null; p.resources = { wood: 2, stone: 1, rice: 2 }; });
    // Replay logs up to step
    for (let i = 0; i <= step && i < session.logs.length; i++) {
      const log = session.logs[i];
      const p = players.find(pl => pl.name === log.player);
      if (!p) continue;
      if (log.action === 'move' && log.details?.to) p.position = log.details.to as string;
    }
    return players;
  };

  const replayPlayers = reconstructPlayers();

  return (
    <MainLayout>
      <div className="flex flex-col h-full overflow-hidden">
        <div className="pixel-card border-b-2 border-border p-2 flex items-center gap-3 shrink-0 flex-wrap">
          <span className="text-accent font-bold text-xs uppercase">{t('replay.title')}</span>
          <label className="pixel-btn bg-secondary text-secondary-foreground text-[10px] font-bold uppercase px-3 py-1.5 cursor-pointer">
            {t('replay.load', '载入存档')}
            <input type="file" accept=".json" className="hidden" onChange={handleLoad} />
          </label>
          {session && (
            <>
              <span className="text-muted-foreground text-[10px]">{session.players.length}{t('replay.players_unit', '人')} · {session.logs.length}{t('replay.log')}</span>
              <div className="h-4 w-0.5 bg-border" />
              <button
                className="pixel-btn bg-primary text-primary-foreground text-[10px] font-bold uppercase px-2 py-1"
                onClick={() => setStep(s => Math.max(0, s - 1))}
                disabled={step <= 0}
              >◀</button>
              <button
                className={`pixel-btn text-[10px] font-bold uppercase px-2 py-1 ${playing ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'}`}
                onClick={() => setPlaying(v => !v)}
              >
                {playing ? '⏸' : '▶'}
              </button>
              <button
                className="pixel-btn bg-primary text-primary-foreground text-[10px] font-bold uppercase px-2 py-1"
                onClick={() => setStep(s => Math.min(session.logs.length - 1, s + 1))}
                disabled={step >= session.logs.length - 1}
              >▶</button>
              <span className="text-[10px] text-muted-foreground">{step + 1} / {session.logs.length}</span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{t('replay.speed')}:</span>
                <select
                  className="pixel-inset bg-input text-foreground text-[10px] px-1 py-0.5 focus:outline-none"
                  value={speed}
                  onChange={e => setSpeed(Number(e.target.value))}
                >
                  <option value={2000}>{t('replay.speed_slow', '慢')}</option>
                  <option value={1000}>{t('replay.speed_normal', '中')}</option>
                  <option value={500}>{t('replay.speed_fast', '快')}</option>
                  <option value={200}>{t('replay.speed_super', '极快')}</option>
                </select>
              </div>
              {/* Progress bar */}
              <div className="flex-1 min-w-24">
                <input
                  type="range" min={0} max={Math.max(0, session.logs.length - 1)}
                  value={step}
                  onChange={e => { setPlaying(false); setStep(Number(e.target.value)); }}
                  className="w-full accent-primary h-2"
                />
              </div>
              <button
                className="pixel-btn bg-secondary text-secondary-foreground text-[10px] font-bold uppercase px-2 py-1"
                onClick={() => { setStep(0); setPlaying(false); }}
              >{t('replay.reset')}</button>
            </>
          )}
        </div>

        {!session ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="pixel-card p-8 text-center">
              <div className="text-muted-foreground text-xs uppercase mb-2">{t('replay.load_hint', '请载入游戏存档')}</div>
              <div className="text-foreground text-[10px]">{t('replay.load_hint_desc', '在游戏运行页保存存档后，将 JSON 文件载入此处')}</div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left: player states */}
            <div className="w-44 shrink-0 bg-sidebar border-r-2 border-sidebar-border flex flex-col overflow-y-auto">
              <div className="p-2 border-b border-sidebar-border text-accent text-[10px] uppercase font-bold">{t('replay.players')}</div>
              {replayPlayers.map(p => (
                <div key={p.id} className="p-2 border-b border-sidebar-border/50">
                  <div className="flex items-center gap-1 mb-1">
                    <div className="w-2 h-2" style={{ backgroundColor: p.color }} />
                    <span className="text-[11px] font-bold" style={{ color: p.color }}>{p.name}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground grid grid-cols-3 gap-0.5">
                    <span>{t('replay.wood_unit')}:{p.resources.wood}</span>
                    <span>{t('replay.stone_unit')}:{p.resources.stone}</span>
                    <span>{t('replay.rice_unit')}:{p.resources.rice}</span>
                  </div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">{t('replay.position', '位置')}: {p.position || t('replay.start', '起始')}</div>
                </div>
              ))}
            </div>

            {/* Center: current log details */}
            <div className="flex-1 min-w-0 overflow-y-auto p-4">
              {currentLog && (
                <div className="pixel-card p-4 mb-4">
                  <div className="text-accent text-xs uppercase font-bold mb-2">{t('replay.current_event', '当前事件')}</div>
                  <div className="text-sm font-bold text-foreground">
                    <span className="text-muted-foreground">{t('runner.round')} {currentLog.round} {t('common.round')}</span>
                    <span className="text-accent mx-2">[{currentLog.player}]</span>
                    <span>{currentLog.action}</span>
                  </div>
                  <div className="mt-2 pixel-inset bg-input p-2">
                    <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap">
                      {JSON.stringify(currentLog.details, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* All logs scroll */}
              <div className="pixel-card overflow-hidden">
                <div className="text-accent text-xs font-bold uppercase p-2 border-b border-border">{t('replay.log')}</div>
                <div className="overflow-y-auto max-h-96 p-2">
                  {currentLogs.map((log, i) => (
                    <div
                      key={log.id || i}
                      ref={i === currentLogs.length - 1 ? logEndRef : null}
                      className={`text-[10px] py-0.5 border-b border-border/30 ${i === step ? 'text-primary font-bold bg-primary/10' : 'text-muted-foreground'}`}
                    >
                      <span className="text-muted-foreground">R{log.round}</span>
                      <span className="text-accent ml-1">[{log.player}]</span>
                      <span className="ml-1">{log.action}</span>
                      {log.details?.tile != null && <span className="text-foreground ml-1">→ {String(log.details.tile as unknown)}</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: round summary */}
            <div className="w-44 shrink-0 bg-sidebar border-l-2 border-sidebar-border flex flex-col overflow-y-auto">
              <div className="p-2 border-b border-sidebar-border text-accent text-[10px] uppercase font-bold">{t('replay.round_stats', '回合统计')}</div>
              <div className="p-2 flex flex-col gap-1">
                {Array.from(new Set(currentLogs.map(l => l.round))).map(round => (
                  <div key={round} className="text-[10px] border border-border p-1">
                    <span className="text-accent font-bold">R{round}</span>
                    <span className="text-muted-foreground ml-1">
                      {t('replay.logs_count').replace('{n}', String(currentLogs.filter(l => l.round === round).length))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
