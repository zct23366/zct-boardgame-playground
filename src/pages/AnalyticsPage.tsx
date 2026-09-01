import React, { useState } from 'react';
import { toast } from 'sonner';
import { useProject } from '@/contexts/ProjectContext';
import { getGameSessions } from '@/lib/api';
import type { GameSession, LogEntry } from '@/types/types';
import MainLayout from '@/components/layouts/MainLayout';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';

const CHART_COLORS = ['#00ff41', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function AnalyticsPage() {
  const { currentProject, t } = useProject();
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importedSessions, setImportedSessions] = useState<GameSession[]>([]);

  const loadSessions = async () => {
    if (!currentProject) { toast.error(t('analytics.select_project_first')); return; }
    setLoading(true);
    try {
      const data = await getGameSessions(currentProject.id);
      setSessions(data);
      setLoaded(true);
      if (data.length === 0) toast.info(t('analytics.no_sessions'));
    } catch { toast.error(t('analytics.load_failed')); }
    finally { setLoading(false); }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const data = JSON.parse(ev.target?.result as string) as GameSession;
          setImportedSessions(prev => [...prev, data]);
          toast.success(t('analytics.imported_toast').replace('{name}', file.name));
        } catch { toast.error(t('analytics.invalid_save').replace('{name}', file.name)); }
      };
      reader.readAsText(file);
    });
    e.target.value = '';
  };

  const allSessions = [...sessions, ...importedSessions];
  const analyzedSessions = allSessions.filter(s =>
    selectedSessions.size === 0 ? true : selectedSessions.has(s.id)
  );
  const allLogs = analyzedSessions.flatMap(s => s.logs);

  // Compute stats
  const actionCounts = allLogs.reduce<Record<string, number>>((acc, l) => {
    acc[l.action] = (acc[l.action] || 0) + 1;
    return acc;
  }, {});

  const woodKey = t('runner.gain_wood');
  const stoneKey = t('runner.gain_stone');
  const riceKey = t('runner.gain_rice');
  const resourceGains = allLogs.reduce<Record<string, number>>((acc, l) => {
    if (l.action === 'move' && l.details?.effects) {
      const effects = l.details.effects as string[];
      effects.forEach(e => {
        if (e.includes(woodKey)) acc[woodKey] = (acc[woodKey] || 0) + 1;
        if (e.includes(stoneKey)) acc[stoneKey] = (acc[stoneKey] || 0) + 1;
        if (e.includes(riceKey)) acc[riceKey] = (acc[riceKey] || 0) + 1;
      });
    }
    return acc;
  }, {});

  const tileCounts = allLogs.reduce<Record<string, number>>((acc, l) => {
    if (l.action === 'move' && l.details?.tile) {
      const t = l.details.tile as string;
      acc[t] = (acc[t] || 0) + 1;
    }
    return acc;
  }, {});

  const playerStats = analyzedSessions.flatMap(s => s.players).reduce<Record<string, { moves: number; resources: { wood: number; stone: number; rice: number } }>>(
    (acc, p) => {
      if (!acc[p.name]) acc[p.name] = { moves: 0, resources: { wood: 0, stone: 0, rice: 0 } };
      acc[p.name].resources.wood += p.resources.wood;
      acc[p.name].resources.stone += p.resources.stone;
      acc[p.name].resources.rice += p.resources.rice;
      return acc;
    }, {}
  );

  analyzedSessions.flatMap(s => s.logs).filter(l => l.action === 'move').forEach(l => {
    if (playerStats[l.player]) playerStats[l.player].moves += 1;
  });

  const actionChartData = Object.entries(actionCounts).map(([name, value]) => ({ name, value }));
  const resourceChartData = Object.entries(resourceGains).map(([name, value]) => ({ name, value }));
  const tileChartData = Object.entries(tileCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value }));
  const playerChartData = Object.entries(playerStats).map(([name, stats]) => ({
    name, moves: stats.moves, ...stats.resources
  }));

  const exportChart = (chartId: string) => {
    const svg = document.querySelector(`#${chartId} svg`) as SVGElement;
    if (!svg) { toast.error(t('analytics.export_failed')); return; }
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    canvas.width = 600; canvas.height = 300;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#1a1f2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const img = new Image();
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `chart_${chartId}.png`;
      a.click();
    };
    img.src = url;
    toast.success(t('analytics.exporting', '导出中...'));
  };

  return (
    <MainLayout>
      <div className="flex flex-col h-full overflow-hidden">
        <div className="pixel-card border-b-2 border-border p-2 flex items-center gap-3 shrink-0 flex-wrap">
          <span className="text-accent font-bold text-xs uppercase">{t('analytics.title')}</span>
          <button
            className="pixel-btn bg-primary text-primary-foreground text-[10px] font-bold uppercase px-2 py-1"
            onClick={loadSessions}
            disabled={loading}
          >
            {loading ? '...' : t('analytics.load_sessions', '加载游戏记录')}
          </button>
          <label className="pixel-btn bg-secondary text-secondary-foreground text-[10px] font-bold uppercase px-2 py-1 cursor-pointer">
            {t('analytics.import_save', '导入存档')}
            <input type="file" accept=".json" multiple className="hidden" onChange={handleImport} />
          </label>
          <span className="text-muted-foreground text-[10px]">{allSessions.length} {t('analytics.sessions_unit', '场游戏')} · {allLogs.length} {t('analytics.logs_unit', '条日志')}</span>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left: session filter */}
          {allSessions.length > 0 && (
            <div className="w-44 shrink-0 bg-sidebar border-r-2 border-sidebar-border flex flex-col overflow-y-auto">
              <div className="p-2 border-b border-sidebar-border">
                <div className="text-accent text-[10px] uppercase font-bold mb-1">{t('analytics.filter', '筛选游戏')}</div>
                <div className="text-muted-foreground text-[9px]">{t('analytics.filter_hint', '不选则分析全部')}</div>
              </div>
              {allSessions.map(s => (
                <div
                  key={s.id}
                  className={`px-2 py-2 border-b border-sidebar-border/50 cursor-pointer text-[10px]
                    ${selectedSessions.has(s.id) ? 'bg-sidebar-accent text-primary' : 'text-muted-foreground hover:bg-sidebar-accent/50'}
                  `}
                  onClick={() => setSelectedSessions(prev => {
                    const n = new Set(prev);
                    if (n.has(s.id)) n.delete(s.id); else n.add(s.id);
                    return n;
                  })}
                >
                  <div className="font-bold truncate">{s.name}</div>
                  <div>{s.players.length}{t('replay.players_unit', '人')} · R{s.game_state.currentRound}</div>
                </div>
              ))}
            </div>
          )}

          {/* Charts */}
          <div className="flex-1 min-w-0 overflow-y-auto p-4">
            {allLogs.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <div className="pixel-card p-8 text-center">
                  <div className="text-muted-foreground text-xs uppercase">{t('common.empty')}</div>
                  <div className="text-foreground text-[10px] mt-2">{t('analytics.empty_hint', '加载游戏记录或导入存档后分析')}</div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Action distribution */}
                <div className="pixel-card p-3" id="chart-actions">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-accent text-[10px] uppercase font-bold">{t('analytics.action_dist', '动作分布')}</span>
                    <button className="pixel-btn bg-secondary text-secondary-foreground text-[9px] font-bold px-2 py-0.5" onClick={() => exportChart('chart-actions')}>{t('analytics.export_png', '导出PNG')}</button>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={actionChartData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {actionChartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#1a1f2e', border: '2px solid #333', borderRadius: 0, fontFamily: 'monospace', fontSize: 10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Resource gains */}
                <div className="pixel-card p-3" id="chart-resources">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-accent text-[10px] uppercase font-bold">{t('analytics.resource_gains', '资源获取次数')}</span>
                    <button className="pixel-btn bg-secondary text-secondary-foreground text-[9px] font-bold px-2 py-0.5" onClick={() => exportChart('chart-resources')}>{t('analytics.export_png', '导出PNG')}</button>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={resourceChartData} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="0" stroke="#333" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: 'monospace' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: 'monospace' }} />
                      <Tooltip contentStyle={{ background: '#1a1f2e', border: '2px solid #333', borderRadius: 0, fontFamily: 'monospace', fontSize: 10 }} />
                      <Bar dataKey="value" fill="#00ff41" radius={0} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Tile access frequency */}
                <div className="pixel-card p-3" id="chart-tiles">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-accent text-[10px] uppercase font-bold">{t('analytics.tile_access', '格子访问频率')} (Top 10)</span>
                    <button className="pixel-btn bg-secondary text-secondary-foreground text-[9px] font-bold px-2 py-0.5" onClick={() => exportChart('chart-tiles')}>{t('analytics.export_png', '导出PNG')}</button>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={tileChartData} barCategoryGap="30%" layout="vertical">
                      <CartesianGrid strokeDasharray="0" stroke="#333" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: 'monospace' }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: 'monospace' }} width={60} />
                      <Tooltip contentStyle={{ background: '#1a1f2e', border: '2px solid #333', borderRadius: 0, fontFamily: 'monospace', fontSize: 10 }} />
                      <Bar dataKey="value" fill="#f59e0b" radius={0} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Player comparison */}
                <div className="pixel-card p-3" id="chart-players">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-accent text-[10px] uppercase font-bold">{t('analytics.player_compare', '玩家资源比较')}</span>
                    <button className="pixel-btn bg-secondary text-secondary-foreground text-[9px] font-bold px-2 py-0.5" onClick={() => exportChart('chart-players')}>{t('analytics.export_png', '导出PNG')}</button>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={playerChartData} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="0" stroke="#333" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: 'monospace' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: 'monospace' }} />
                      <Tooltip contentStyle={{ background: '#1a1f2e', border: '2px solid #333', borderRadius: 0, fontFamily: 'monospace', fontSize: 10 }} />
                      <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'monospace' }} />
                      <Bar dataKey="wood" name={t('common.wood')} fill="#22c55e" />
                      <Bar dataKey="stone" name={t('common.stone')} fill="#78716c" />
                      <Bar dataKey="rice" name={t('common.rice')} fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Summary stats */}
                <div className="pixel-card p-3 md:col-span-2">
                  <div className="text-accent text-[10px] uppercase font-bold mb-3">{t('analytics.summary', '汇总统计')}</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { label: t('analytics.total_games', '总游戏场数'), value: analyzedSessions.length },
                      { label: t('analytics.total_logs', '总日志条数'), value: allLogs.length },
                      { label: t('analytics.move_count', '移动动作数'), value: allLogs.filter(l => l.action === 'move').length },
                      { label: t('analytics.avg_logs', '平均每场日志'), value: analyzedSessions.length ? Math.round(allLogs.length / analyzedSessions.length) : 0 },
                    ].map(stat => (
                      <div key={stat.label} className="pixel-inset bg-input p-2 text-center">
                        <div className="text-primary text-lg font-bold">{stat.value}</div>
                        <div className="text-muted-foreground text-[9px] uppercase">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
