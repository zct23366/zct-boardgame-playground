import React, { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useProject } from '@/contexts/ProjectContext';
import { getMaps, createMap, updateMap, deleteMap, getTileTemplates } from '@/lib/api';
import type { GameMap, MapTile } from '@/types/types';
import MainLayout from '@/components/layouts/MainLayout';

const TILE_SIZE = 48;

// 昼间颜色
const DAY_COLORS: Record<string, string> = {
  Forest: '#22c55e', Mine: '#78716c', Market: '#f59e0b',
  Village: '#3b82f6', City: '#8b5cf6', Empty: '#374151',
  Road: '#6b7280', Mountain: '#a16207', River: '#0ea5e9',
  Desert: '#ca8a04', Lake: '#0284c7', Event: '#ec4899',
  Ruins: '#9ca3af', Bandit: '#dc2626', NightMarket: '#d97706',
  CollectFee: '#2563eb',
};

// 夜间颜色（更深、更冷色调，区别明显）
const NIGHT_COLORS: Record<string, string> = {
  Forest: '#14532d', Mine: '#292524', Market: '#78350f',
  Village: '#1e3a5f', City: '#3b0764', Empty: '#111827',
  Road: '#1f2937', Mountain: '#451a03', River: '#0c4a6e',
  Desert: '#713f12', Lake: '#0c4a6e', Event: '#831843',
  Ruins: '#374151', Bandit: '#7f1d1d', NightMarket: '#92400e',
  CollectFee: '#1e3a5f',
};

// 夜间类型的图标标识
const NIGHT_ICONS: Record<string, string> = {
  Ruins: '☠', Bandit: '⚔', NightMarket: '$', CollectFee: '¥',
  Empty: '', Forest: '🌑', Mine: '💀', Market: '🌙',
  Village: '🏚', City: '🌆', Event: '👁',
};

function getTileColor(type: string, isNight: boolean): string {
  if (isNight) return NIGHT_COLORS[type] || '#1a1a2e';
  return DAY_COLORS[type] || '#374151';
}

function genId() { return 't_' + Math.random().toString(36).slice(2, 9); }

const TILE_TYPES = [
  'Forest', 'Mine', 'Market', 'Village', 'City', 'Empty',
  'Ruins', 'Bandit', 'NightMarket', 'CollectFee', 'Event', 'Road',
  'Mountain', 'River', 'Desert', 'Lake'
];

// ── Undo history hook ───────────────────────────────────────────────────────
function useHistory<T>(initial: T) {
  const [past, setPast] = useState<T[]>([]);
  const [present, setPresent] = useState<T>(initial);
  const [future, setFuture] = useState<T[]>([]);

  const pushState = useCallback((newState: T) => {
    setPast(p => [...p.slice(-49), newState]);
    setPresent(newState);
    setFuture([]);
  }, []);

  // expose refs so undo/redo can read latest past/future without stale closures
  const pastRef = useRef(past);
  const futureRef = useRef(future);
  const presentRef = useRef(present);
  pastRef.current = past;
  futureRef.current = future;
  presentRef.current = present;

  const undo = useCallback((): T | null => {
    const p = pastRef.current;
    if (p.length === 0) return null;
    const prev = p[p.length - 1];
    setFuture(f => [presentRef.current, ...f]);
    setPresent(prev);
    setPast(p.slice(0, -1));
    return prev;
  }, []);

  const redo = useCallback((): T | null => {
    const f = futureRef.current;
    if (f.length === 0) return null;
    const next = f[0];
    setPast(p => [...p, presentRef.current]);
    setPresent(next);
    setFuture(f.slice(1));
    return next;
  }, []);

  const reset = useCallback((s: T) => {
    setPresent(s);
    setPast([]);
    setFuture([]);
  }, []);

  return {
    state: present, pushState, undo, redo, reset,
    canUndo: past.length > 0, canRedo: future.length > 0,
    pastCount: past.length,
  };
}

// ── TileBlock ────────────────────────────────────────────────────────────────
function TileBlock({ tile, isSelected, isNight, onClick, onRightClick, t }: {
  tile: MapTile; isSelected: boolean; isNight: boolean;
  onClick: () => void; onRightClick: (e: React.MouseEvent) => void;
  t: (k: string) => string;
}) {
  const activeType = isNight
    ? (tile.nightTransformTo || tile.nightType)
    : tile.dayType;
  const color = getTileColor(activeType, isNight);
  const dayColor = getTileColor(tile.dayType, false);
  const nightColor = getTileColor(tile.nightTransformTo || tile.nightType, true);
  const typeChanged = tile.dayType !== (tile.nightTransformTo || tile.nightType);
  const hasNightOverride = tile.nightCanStop !== undefined || tile.nightCanBuild !== undefined || tile.nightHasEvent !== undefined;
  const nightEffectiveCanStop = tile.nightCanStop !== undefined ? tile.nightCanStop : tile.canStop;

  return (
    <div
      onClick={onClick}
      onContextMenu={onRightClick}
      className={`tile-hover ${isSelected ? 'tile-active' : ''}`}
      style={{
        width: TILE_SIZE, height: TILE_SIZE,
        backgroundColor: color,
        border: isSelected
          ? '3px solid #00ff41'
          : isNight ? '2px solid rgba(100,100,200,0.45)' : '2px solid rgba(0,0,0,0.5)',
        boxShadow: isSelected
          ? 'inset 0 0 0 1px rgba(255,255,255,0.3), 0 0 0 1px #00ff41'
          : isNight
            ? 'inset 2px 2px 0 rgba(100,100,200,0.2), inset -1px -1px 0 rgba(0,0,0,0.6)'
            : 'inset 2px 2px 0 rgba(255,255,255,0.15), inset -1px -1px 0 rgba(0,0,0,0.4)',
        position: 'relative', cursor: 'pointer', flexShrink: 0,
        transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
      }}
      title={[
        `${tile.name}`,
        t('mapeditor.tile_day').replace('{type}', tile.dayType),
        t('mapeditor.tile_night').replace('{type}', `${tile.nightTransformTo || tile.nightType}${tile.nightTransformTo ? t('mapeditor.transform_suffix') : ''}`),
        tile.nightGroupId ? t('mapeditor.tile_group').replace('{id}', tile.nightGroupId) : '',
        tile.transformNote ? t('mapeditor.tile_note').replace('{note}', tile.transformNote) : '',
      ].filter(Boolean).join('\n')}
    >
      {/* Star when type changes at night */}
      {isNight && typeChanged && (
        <div style={{ position: 'absolute', top: 1, left: 2, fontSize: 7, color: 'rgba(200,200,255,0.7)', lineHeight: 1 }}>✦</div>
      )}
      {/* Night type badge */}
      {isNight && typeChanged && (
        <div style={{
          position: 'absolute', top: 0, right: 0, fontSize: 7,
          background: 'rgba(0,0,60,0.75)', color: '#a5b4fc',
          padding: '1px 2px', lineHeight: 1, fontFamily: 'monospace',
        }}>
          {(tile.nightTransformTo || tile.nightType).slice(0, 4)}
        </div>
      )}
      {/* Night group badge */}
      {tile.nightGroupId && (
        <div style={{
          position: 'absolute', bottom: typeChanged ? 5 : 1, right: 1, fontSize: 7,
          background: 'rgba(60,0,80,0.7)', color: '#e879f9',
          padding: '0 2px', lineHeight: '10px', fontFamily: 'monospace',
        }}>
          G
        </div>
      )}
      {/* Transform arrow when nightTransformTo set */}
      {tile.nightTransformTo && !isNight && (
        <div style={{ position: 'absolute', top: 1, right: 1, fontSize: 7, color: '#fb923c', lineHeight: 1 }}>⇌</div>
      )}
      {/* Day/Night split bar */}
      {typeChanged && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, display: 'flex' }}>
          <div style={{ flex: 1, backgroundColor: dayColor, opacity: 0.8 }} />
          <div style={{ flex: 1, backgroundColor: nightColor, opacity: 0.8 }} />
        </div>
      )}
      {/* Night override indicator */}
      {isNight && hasNightOverride && (
        <div style={{ position: 'absolute', top: 1, left: typeChanged ? 10 : 2, fontSize: 7, color: '#818cf8', lineHeight: 1 }}>✎</div>
      )}
      {/* Tile name */}
      <div style={{
        position: 'absolute', bottom: typeChanged ? 5 : 1, left: 2,
        fontSize: 8, color: 'rgba(255,255,255,0.85)', fontFamily: 'monospace',
        lineHeight: 1, maxWidth: TILE_SIZE - 12, overflow: 'hidden', whiteSpace: 'nowrap',
        textShadow: '1px 1px 0 rgba(0,0,0,0.8)',
      }}>
        {tile.name}
      </div>
      {/* Attribute icons */}
      <div style={{ position: 'absolute', top: isNight && typeChanged ? 10 : 2, left: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {(isNight ? tile.nightCanBuild ?? tile.canBuild : tile.canBuild) && (
          <span style={{ fontSize: 8, color: '#86efac', lineHeight: 1, textShadow: '1px 1px 0 rgba(0,0,0,0.8)' }}>⌂</span>
        )}
        {(isNight ? tile.nightHasEvent ?? tile.hasEvent : tile.hasEvent) && (
          <span style={{ fontSize: 8, color: '#f472b6', lineHeight: 1, textShadow: '1px 1px 0 rgba(0,0,0,0.8)' }}>!</span>
        )}
      </div>
      {tile.chargeAtNight && (
        <div style={{ position: 'absolute', top: 2, right: isNight && typeChanged ? 18 : 2, fontSize: 8, color: '#fbbf24', textShadow: '1px 1px 0 rgba(0,0,0,0.8)' }}>¥</div>
      )}
      {/* Can't stop indicator (respects night override) */}
      {!(isNight ? nightEffectiveCanStop : tile.canStop) && (
        <div style={{ position: 'absolute', inset: 0, border: '2px solid #ef4444', opacity: 0.4, pointerEvents: 'none' }} />
      )}
    </div>
  );
}

// ── EmptyCell ────────────────────────────────────────────────────────────────
function EmptyCell({ x, y, isNight, onClick, t }: { x: number; y: number; isNight: boolean; onClick: () => void; t: (k: string) => string }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: TILE_SIZE, height: TILE_SIZE,
        border: `1px dashed ${isNight ? 'rgba(100,100,200,0.2)' : 'rgba(255,255,255,0.12)'}`,
        cursor: 'crosshair', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: isNight ? 'rgba(150,150,255,0.12)' : 'rgba(255,255,255,0.08)', fontSize: 18,
        backgroundColor: isNight ? 'rgba(10,10,40,0.3)' : 'transparent',
      }}
      className="hover:bg-white/5 transition-none"
      title={t('mapeditor.place_tile').replace('{x}', String(x)).replace('{y}', String(y))}
    >
      +
    </div>
  );
}

// ── Inspector Panel ──────────────────────────────────────────────────────────
function TileInspector({ tile, isNight, allTiles, onUpdate, onDelete, t }: {
  tile: MapTile; isNight: boolean; allTiles: MapTile[];
  onUpdate: (updates: Partial<MapTile>) => void;
  onDelete: () => void;
  t: (key: string, fallback?: string) => string;
}) {
  // Active tab: 'day' | 'night'
  const [activeTab, setActiveTab] = useState<'day' | 'night'>(isNight ? 'night' : 'day');

  // Sync tab when map night toggle changes
  useEffect(() => { setActiveTab(isNight ? 'night' : 'day'); }, [isNight]);

  const dayColor = getTileColor(tile.dayType, false);
  const effectiveNightType = tile.nightTransformTo || tile.nightType;
  const nightColor = getTileColor(effectiveNightType, true);
  const typeChanged = tile.dayType !== effectiveNightType;
  const existingGroups = [...new Set(allTiles.map(t => t.nightGroupId).filter(Boolean))] as string[];

  // Three-state night override checkbox
  const renderNightOverride = (
    label: string, icon: string,
    dayVal: boolean, nightVal: boolean | undefined,
    field: 'nightCanStop' | 'nightCanBuild' | 'nightHasEvent',
  ) => {
    const effective = nightVal !== undefined ? nightVal : dayVal;
    const isOverridden = nightVal !== undefined;
    return (
      <div className="flex items-center gap-1.5">
        <div
          className={`w-4 h-4 border-2 flex items-center justify-center text-[9px] shrink-0 cursor-pointer
            ${effective ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-input'}
            ${isOverridden ? 'ring-1 ring-accent' : ''}`}
          onClick={() => {
            if (!isOverridden) onUpdate({ [field]: !dayVal });
            else if (nightVal === !dayVal) onUpdate({ [field]: undefined });
            else onUpdate({ [field]: !nightVal });
          }}
        >{effective && '✓'}</div>
        <span className={`text-[9px] flex-1 ${isOverridden ? 'text-accent font-bold' : 'text-foreground'}`}>
          {icon} {label}
        </span>
        {isOverridden ? (
          <button className="text-[8px] text-muted-foreground hover:text-destructive" title={t('mapeditor.reset_to_day')}
            onClick={() => onUpdate({ [field]: undefined })}>↺</button>
        ) : (
          <span className="text-[8px] text-muted-foreground/40">{t('mapeditor.same_as_day')}</span>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header row */}
      <div className="px-2 pt-2 flex items-center justify-between shrink-0">
        <span className="text-[9px] text-muted-foreground uppercase">{tile.name} · ({tile.x},{tile.y})</span>
        <button className="pixel-btn bg-destructive text-destructive-foreground text-[9px] px-1.5 py-0.5" onClick={onDelete}>✕</button>
      </div>

      {/* Day / Night tab switcher */}
      <div className="px-2 pt-1.5 shrink-0">
        <div className="flex gap-0" style={{ border: '2px solid rgba(255,255,255,0.1)' }}>
          <button
            className={`flex-1 py-1.5 text-[9px] font-bold uppercase flex flex-col items-center gap-0.5 transition-none
              ${activeTab === 'day' ? 'bg-amber-900/60 text-yellow-200' : 'bg-input text-muted-foreground hover:bg-input/80'}`}
            onClick={() => setActiveTab('day')}
          >
            <div style={{ width: '100%', height: 20, backgroundColor: dayColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 7, color: '#fff', fontFamily: 'monospace' }}>☀ {tile.dayType}</span>
            </div>
            <span>{t('mapeditor.day_config')}</span>
          </button>
          <div style={{ width: 2, background: 'rgba(255,255,255,0.08)' }} />
          <button
            className={`flex-1 py-1.5 text-[9px] font-bold uppercase flex flex-col items-center gap-0.5 transition-none
              ${activeTab === 'night' ? 'bg-indigo-900/60 text-indigo-200' : 'bg-input text-muted-foreground hover:bg-input/80'}`}
            onClick={() => setActiveTab('night')}
          >
            <div style={{ width: '100%', height: 20, backgroundColor: nightColor, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <span style={{ fontSize: 7, color: '#c7d2fe', fontFamily: 'monospace' }}>🌙 {effectiveNightType}</span>
              {typeChanged && <span style={{ position: 'absolute', top: 0, right: 0, fontSize: 6, color: '#fb923c', padding: '0 1px' }}>⚡</span>}
            </div>
            <span>{t('mapeditor.night_config')}</span>
          </button>
        </div>
        {typeChanged && (
          <div className="text-[8px] text-orange-400 text-center mt-0.5">{t('mapeditor.day_night_diff')}</div>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        {activeTab === 'day' ? (
          <>
            {/* ── 昼间配置 ── */}
            <div className="text-[9px] text-yellow-400/80 uppercase border-b border-yellow-400/20 pb-0.5">{t('mapeditor.day_attrs')}</div>

            <div>
              <label className="text-[9px] text-muted-foreground uppercase block mb-0.5">{t('mapeditor.tile_name')}</label>
              <input className="pixel-inset bg-input text-foreground text-[10px] px-2 py-1 w-full focus:outline-none"
                value={tile.name} onChange={e => onUpdate({ name: e.target.value })} />
            </div>

            <div>
              <label className="text-[9px] text-muted-foreground uppercase block mb-0.5">
                {t('mapeditor.day_type')} <span style={{ color: dayColor }}>■</span>
              </label>
              <select className="pixel-inset bg-input text-foreground text-[10px] px-2 py-1 w-full focus:outline-none"
                value={tile.dayType}
                onChange={e => onUpdate({ dayType: e.target.value, color: DAY_COLORS[e.target.value] || tile.color })}>
                {TILE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[9px] text-muted-foreground uppercase">{t('mapeditor.custom_color')}</label>
              <input type="color" className="w-8 h-6 pixel-inset cursor-pointer" value={tile.color} onChange={e => onUpdate({ color: e.target.value })} />
            </div>

            <div className="flex flex-col gap-1.5">
              {([
                { key: 'canStop', label: t('mapeditor.can_stop'), icon: '●' },
                { key: 'canBuild', label: t('mapeditor.can_build'), icon: '⌂' },
                { key: 'hasEvent', label: t('mapeditor.has_event'), icon: '!' },
                { key: 'chargeAtNight', label: t('mapeditor.charge_night'), icon: '¥' },
                { key: 'replaceable', label: t('mapeditor.replaceable'), icon: '↔' },
              ] as const).map(({ key, label, icon }) => (
                <div key={key} className="flex items-center gap-2 cursor-pointer" onClick={() => onUpdate({ [key]: !tile[key] })}>
                  <div className={`w-4 h-4 border-2 flex items-center justify-center text-[9px] shrink-0
                    ${tile[key] ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-input'}`}>
                    {tile[key] && '✓'}
                  </div>
                  <span className="text-[9px] text-foreground">{icon} {label}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* ── 夜间配置 ── */}
            <div className="text-[9px] text-indigo-300/80 uppercase border-b border-indigo-400/20 pb-0.5">{t('mapeditor.night_form')}</div>

            <div>
              <label className="text-[9px] text-muted-foreground uppercase block mb-0.5">
                {t('mapeditor.night_type')} <span style={{ color: nightColor }}>■</span>
              </label>
              <select className="pixel-inset bg-input text-foreground text-[10px] px-2 py-1 w-full focus:outline-none"
                value={tile.nightType}
                onChange={e => onUpdate({ nightType: e.target.value })}>
                {TILE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[9px] text-muted-foreground uppercase block mb-0.5">
                {t('mapeditor.night_transform')} <span className="text-[8px] text-muted-foreground/50 normal-case">(覆盖外观+效果)</span>
              </label>
              <div className="flex gap-1">
                <select className="pixel-inset bg-input text-foreground text-[10px] px-2 py-1 flex-1 focus:outline-none"
                  value={tile.nightTransformTo || ''}
                  onChange={e => onUpdate({ nightTransformTo: e.target.value || undefined })}>
                  <option value="">{t('mapeditor.no_transform')}</option>
                  {TILE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {tile.nightTransformTo && (
                  <button className="pixel-btn bg-muted text-muted-foreground text-[9px] px-1.5"
                    onClick={() => onUpdate({ nightTransformTo: undefined })}>✕</button>
                )}
              </div>
              {tile.nightTransformTo && (
                <div className="flex items-center gap-1 mt-0.5">
                  <div style={{ width: 10, height: 10, background: dayColor, border: '1px solid rgba(255,255,255,0.2)' }} />
                  <span style={{ fontSize: 7, color: '#6b7280' }}>☀→🌙</span>
                  <div style={{ width: 10, height: 10, background: getTileColor(tile.nightTransformTo, true), border: '1px solid rgba(255,255,255,0.2)' }} />
                  <span style={{ fontSize: 8, color: '#a5b4fc' }}>{tile.nightTransformTo}</span>
                </div>
              )}
            </div>

            <div className="text-[9px] text-indigo-300/80 uppercase border-b border-indigo-400/20 pb-0.5 mt-1">🌙 {t('mapeditor.night_override')}</div>
            <div className="text-[8px] text-muted-foreground/60 -mt-1">{t('mapeditor.inherit_day')}</div>

            <div className="pixel-inset bg-indigo-900/20 p-1.5 flex flex-col gap-1.5">
              {renderNightOverride(t('mapeditor.can_stop'), '●', tile.canStop, tile.nightCanStop, 'nightCanStop')}
              {renderNightOverride(t('mapeditor.can_build'), '⌂', tile.canBuild, tile.nightCanBuild, 'nightCanBuild')}
              {renderNightOverride(t('mapeditor.has_event'), '!', tile.hasEvent, tile.nightHasEvent, 'nightHasEvent')}
            </div>

            <div className="text-[9px] text-indigo-300/80 uppercase border-b border-indigo-400/20 pb-0.5 mt-1">{t('mapeditor.transform_group')}</div>

            <div>
              <label className="text-[9px] text-muted-foreground uppercase block mb-0.5">
                {t('mapeditor.group_id')} <span className="text-[8px] normal-case text-muted-foreground/50">{t('mapeditor.group_hint')}</span>
              </label>
              <div className="flex gap-1">
                <input className="pixel-inset bg-input text-foreground text-[10px] px-2 py-1 flex-1 focus:outline-none"
                  placeholder={t('mapeditor.group_ph')}
                  value={tile.nightGroupId || ''}
                  onChange={e => onUpdate({ nightGroupId: e.target.value || undefined })}
                  list="group-datalist" />
                {tile.nightGroupId && (
                  <button className="pixel-btn bg-muted text-muted-foreground text-[9px] px-1.5"
                    onClick={() => onUpdate({ nightGroupId: undefined })}>✕</button>
                )}
              </div>
              {existingGroups.length > 0 && (
                <>
                  <datalist id="group-datalist">
                    {existingGroups.map(g => <option key={g} value={g} />)}
                  </datalist>
                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                    {existingGroups.map(g => (
                      <button key={g}
                        className={`text-[8px] px-1 border ${tile.nightGroupId === g ? 'border-accent text-accent' : 'border-border text-muted-foreground'}`}
                        onClick={() => onUpdate({ nightGroupId: g })}>{g}</button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div>
              <label className="text-[9px] text-muted-foreground uppercase block mb-0.5">{t('mapeditor.transform_note')}</label>
              <input className="pixel-inset bg-input text-foreground text-[10px] px-2 py-1 w-full focus:outline-none"
                placeholder={t('mapeditor.transform_note_ph')}
                value={tile.transformNote || ''}
                onChange={e => onUpdate({ transformNote: e.target.value || undefined })} />
            </div>
          </>
        )}

        {/* Position footer */}
        <div className="pixel-inset bg-input p-1 text-[8px] text-muted-foreground mt-auto">
          ({tile.x},{tile.y}) · {tile.id.slice(0, 12)}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function MapEditorPage() {
  const { currentProject, setCurrentMap, tileTemplates, setTileTemplates, t } = useProject();
  const [maps, setMaps] = useState<GameMap[]>([]);
  const [activeMap, setActiveMap] = useState<GameMap | null>(null);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [isNight, setIsNight] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newMapName, setNewMapName] = useState('');
  const [editNameId, setEditNameId] = useState<string | null>(null);
  const [editNameVal, setEditNameVal] = useState('');
  const [paintTileType, setPaintTileType] = useState('Forest');
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Undo/Redo for tiles
  const tilesHistory = useHistory<MapTile[]>([]);

  const selectedTile = activeMap?.tiles.find(t => t.id === selectedTileId) ?? null;

  const loadData = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const [ms, tt] = await Promise.all([
        getMaps(currentProject.id),
        getTileTemplates(currentProject.id),
      ]);
      setMaps(ms);
      setTileTemplates(tt);
      if (ms.length > 0) {
        setActiveMap(ms[0]);
        setCurrentMap(ms[0]);
        tilesHistory.reset(ms[0].tiles);
      }
    } catch {
      toast.error(t('mapeditor.load_failed'));
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  useEffect(() => { loadData(); }, [loadData]);

  // Keyboard shortcuts: Ctrl+Z / Ctrl+Y
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const debouncedSave = useCallback((map: GameMap) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      try {
        await updateMap(map.id, { tiles: map.tiles, width: map.width, height: map.height });
      } catch { toast.error(t('mapeditor.autosave_failed')); }
    }, 800);
  }, []);

  // Apply tile changes to map + push to history
  const applyTiles = useCallback((newTiles: MapTile[], saveHistory = true) => {
    setActiveMap(prev => {
      if (!prev) return prev;
      const updated = { ...prev, tiles: newTiles };
      setCurrentMap(updated);
      setMaps(ms => ms.map(m => m.id === updated.id ? updated : m));
      debouncedSave(updated);
      return updated;
    });
    if (saveHistory) tilesHistory.pushState(newTiles);
  }, [debouncedSave, tilesHistory]);

  const handleUndo = useCallback(() => {
    if (!tilesHistory.canUndo) return;
    const prev = tilesHistory.undo();
    if (!prev) return;
    setActiveMap(m => {
      if (!m) return m;
      const updated = { ...m, tiles: prev };
      setCurrentMap(updated);
      setMaps(ms => ms.map(mm => mm.id === updated.id ? updated : mm));
      debouncedSave(updated);
      return updated;
    });
    toast(t('mapeditor.undo_toast'), { duration: 1200 });
  }, [tilesHistory, debouncedSave]);

  const handleRedo = useCallback(() => {
    if (!tilesHistory.canRedo) return;
    const next = tilesHistory.redo();
    if (!next) return;
    setActiveMap(m => {
      if (!m) return m;
      const updated = { ...m, tiles: next };
      setCurrentMap(updated);
      setMaps(ms => ms.map(mm => mm.id === updated.id ? updated : mm));
      debouncedSave(updated);
      return updated;
    });
    toast(t('mapeditor.redo_toast'), { duration: 1200 });
  }, [tilesHistory, debouncedSave]);

  const handleCellClick = (x: number, y: number) => {
    if (!activeMap) return;
    const existing = activeMap.tiles.find(t => t.x === x && t.y === y);
    if (existing) {
      setSelectedTileId(existing.id);
    } else {
      const tpl = tileTemplates.find(t => t.day_type === paintTileType);
      const newTile: MapTile = {
        id: genId(), name: tpl?.name || paintTileType,
        x, y,
        dayType: tpl?.day_type || paintTileType,
        nightType: tpl?.night_type || paintTileType,
        color: tpl?.color || DAY_COLORS[paintTileType] || '#374151',
        canStop: tpl?.can_stop ?? true,
        canBuild: tpl?.can_build ?? false,
        hasEvent: tpl?.has_event ?? false,
        chargeAtNight: tpl?.charge_at_night ?? false,
        replaceable: tpl?.replaceable ?? false,
        replaceList: tpl?.replace_list ?? [],
      };
      applyTiles([...activeMap.tiles, newTile]);
      setSelectedTileId(newTile.id);
    }
  };

  const handleRightClick = (e: React.MouseEvent, tileId: string) => {
    e.preventDefault();
    if (!activeMap) return;
    applyTiles(activeMap.tiles.filter(t => t.id !== tileId));
    if (selectedTileId === tileId) setSelectedTileId(null);
  };

  const updateSelectedTile = (updates: Partial<MapTile>) => {
    if (!selectedTile || !activeMap) return;
    const updated = { ...selectedTile, ...updates };
    applyTiles(activeMap.tiles.map(t => t.id === updated.id ? updated : t));
  };

  const deleteSelectedTile = () => {
    if (!selectedTile || !activeMap) return;
    applyTiles(activeMap.tiles.filter(t => t.id !== selectedTile.id));
    setSelectedTileId(null);
  };

  const handleResizeMap = (dim: 'width' | 'height', val: number) => {
    const v = Math.max(2, Math.min(20, val));
    if (!activeMap) return;
    const filtered = activeMap.tiles.filter(t => dim === 'width' ? t.x < v : t.y < v);
    const updated = { ...activeMap, [dim]: v, tiles: filtered };
    setActiveMap(updated);
    setCurrentMap(updated);
    setMaps(ms => ms.map(m => m.id === updated.id ? updated : m));
    debouncedSave(updated);
    tilesHistory.pushState(filtered);
  };

  const handleCreateMap = async () => {
    if (!currentProject) { toast.error(t('mapeditor.select_project_first')); return; }
    const name = newMapName.trim() || t('mapeditor.new_map_default');
    try {
      const m = await createMap(currentProject.id, name);
      setMaps(prev => [...prev, m]);
      setActiveMap(m);
      setCurrentMap(m);
      tilesHistory.reset(m.tiles);
      setNewMapName('');
      setSelectedTileId(null);
      toast.success(t('mapeditor.map_created').replace('{name}', name));
    } catch { toast.error(t('mapeditor.create_failed')); }
  };

  const handleDeleteMap = async (id: string, name: string) => {
    if (!confirm(t('mapeditor.confirm_delete_map').replace('{name}', name))) return;
    try {
      await deleteMap(id);
      const remaining = maps.filter(m => m.id !== id);
      setMaps(remaining);
      if (activeMap?.id === id) {
        const next = remaining[0] || null;
        setActiveMap(next);
        setCurrentMap(next);
        if (next) tilesHistory.reset(next.tiles);
        setSelectedTileId(null);
      }
      toast.success(t('mapeditor.deleted'));
    } catch { toast.error(t('mapeditor.delete_failed')); }
  };

  const handleRenameMap = async (id: string) => {
    if (!editNameVal.trim()) return;
    try {
      await updateMap(id, { name: editNameVal.trim() });
      setMaps(prev => prev.map(m => m.id === id ? { ...m, name: editNameVal.trim() } : m));
      if (activeMap?.id === id) setActiveMap(prev => prev ? { ...prev, name: editNameVal.trim() } : prev);
      setEditNameId(null);
      toast.success(t('mapeditor.renamed'));
    } catch { toast.error(t('mapeditor.rename_failed')); }
  };

  const handleExport = () => {
    if (!activeMap) return;
    const blob = new Blob([JSON.stringify(activeMap, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${activeMap.name}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeMap) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const data = JSON.parse(ev.target?.result as string) as GameMap;
        applyTiles(data.tiles);
        setActiveMap(prev => prev ? { ...prev, tiles: data.tiles, width: data.width, height: data.height } : prev);
        toast.success(t('mapeditor.imported_toast'));
      } catch { toast.error(t('mapeditor.invalid_json')); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (!currentProject) {
    return (
      <MainLayout>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="pixel-card p-8 text-center">
            <div className="text-muted-foreground text-xs uppercase mb-2">{t('mapeditor.select_project_first')}</div>
            <div className="text-foreground text-xs">{t('mapeditor.go_project_mgmt')} <span className="text-primary">{t('mapeditor.project_mgmt_link')}</span> {t('mapeditor.select_or_create_project')}</div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex h-screen overflow-hidden flex-col">
        {/* Toolbar */}
        <div className="pixel-card border-b-2 border-border p-2 flex items-center gap-2 flex-wrap shrink-0">
          <span className="text-accent text-xs font-bold uppercase">{t('mapeditor.title')}</span>
          <div className="h-4 w-0.5 bg-border hidden md:block" />

          {/* Undo / Redo */}
          <button
            className={`pixel-btn text-[10px] font-bold uppercase px-2 py-1 ${tilesHistory.canUndo ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
            onClick={handleUndo} disabled={!tilesHistory.canUndo} title={t('mapeditor.undo')}
          >◀ {t('mapeditor.undo')}</button>
          <button
            className={`pixel-btn text-[10px] font-bold uppercase px-2 py-1 ${tilesHistory.canRedo ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
            onClick={handleRedo} disabled={!tilesHistory.canRedo} title={t('mapeditor.redo')}
          >{t('mapeditor.redo')} ▶</button>
          <span className="text-[9px] text-muted-foreground hidden md:inline">
            {tilesHistory.pastCount > 0 ? t('mapeditor.undo_count').replace('{count}', String(tilesHistory.pastCount)) : ''}
          </span>

          <div className="h-4 w-0.5 bg-border hidden md:block" />

          {/* Night toggle */}
          <button
            className={`pixel-btn text-[10px] font-bold uppercase px-2 py-1 ${isNight ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'}`}
            onClick={() => setIsNight(v => !v)}
          >
            {isNight ? t('mapeditor.night_preview') : t('mapeditor.day_preview')}
          </button>

          {/* Resize */}
          {activeMap && (
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground text-[10px]">W:</span>
              <input type="number" min={2} max={20}
                className="pixel-inset bg-input text-foreground text-[10px] w-12 px-1 text-center focus:outline-none"
                value={activeMap.width}
                onChange={e => handleResizeMap('width', parseInt(e.target.value) || 2)}
              />
              <span className="text-muted-foreground text-[10px]">H:</span>
              <input type="number" min={2} max={20}
                className="pixel-inset bg-input text-foreground text-[10px] w-12 px-1 text-center focus:outline-none"
                value={activeMap.height}
                onChange={e => handleResizeMap('height', parseInt(e.target.value) || 2)}
              />
            </div>
          )}
          <div className="flex-1" />
          <button className="pixel-btn bg-secondary text-secondary-foreground text-[10px] font-bold uppercase px-2 py-1" onClick={handleExport}>{t('mapeditor.export')} JSON</button>
          <label className="pixel-btn bg-secondary text-secondary-foreground text-[10px] font-bold uppercase px-2 py-1 cursor-pointer">
            {t('mapeditor.import_json')}
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left: map list */}
          <div className="w-40 shrink-0 bg-sidebar border-r-2 border-sidebar-border flex flex-col">
            <div className="p-2 border-b border-sidebar-border">
              <div className="text-accent text-[10px] uppercase font-bold mb-2">{t('mapeditor.map_list')}</div>
              <div className="flex gap-1">
                <input
                  className="pixel-inset bg-input text-foreground text-[10px] px-1 py-1 flex-1 focus:outline-none"
                  placeholder={t('mapeditor.new_map_name_ph')}
                  value={newMapName}
                  onChange={e => setNewMapName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateMap()}
                />
                <button className="pixel-btn bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1" onClick={handleCreateMap}>+</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {maps.map(m => (
                <div key={m.id} className={`px-2 py-2 border-b border-sidebar-border/50 cursor-pointer
                  ${activeMap?.id === m.id ? 'bg-sidebar-accent border-l-2 border-l-primary' : 'hover:bg-sidebar-accent/50'}`}
                >
                  {editNameId === m.id ? (
                    <div className="flex gap-1">
                      <input
                        className="pixel-inset bg-input text-foreground text-[10px] px-1 py-0.5 flex-1 focus:outline-none"
                        value={editNameVal}
                        onChange={e => setEditNameVal(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRenameMap(m.id); if (e.key === 'Escape') setEditNameId(null); }}
                        autoFocus
                      />
                      <button className="text-primary text-[10px]" onClick={() => handleRenameMap(m.id)}>✓</button>
                    </div>
                  ) : (
                    <div onClick={() => {
                      setActiveMap(m); setCurrentMap(m); setSelectedTileId(null);
                      tilesHistory.reset(m.tiles);
                    }}>
                      <div className="text-[11px] font-bold text-foreground truncate">
                        {activeMap?.id === m.id && <span className="text-primary mr-1">▶</span>}
                        {m.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{t('mapeditor.map_size').replace('{w}', String(m.width)).replace('{h}', String(m.height)).replace('{n}', String(m.tiles.length))}</div>
                    </div>
                  )}
                  {editNameId !== m.id && (
                    <div className="flex gap-1 mt-1">
                      <button className="text-muted-foreground text-[9px] hover:text-foreground" onClick={e => { e.stopPropagation(); setEditNameId(m.id); setEditNameVal(m.name); }}>{t('mapeditor.rename_btn')}</button>
                      <button className="text-destructive text-[9px] hover:text-red-400" onClick={e => { e.stopPropagation(); handleDeleteMap(m.id, m.name); }}>{t('mapeditor.delete_btn')}</button>
                    </div>
                  )}
                </div>
              ))}
              {maps.length === 0 && !loading && (
                <div className="p-3 text-muted-foreground text-[10px] text-center">{t('mapeditor.no_map')}</div>
              )}
            </div>
          </div>

          {/* Center: grid canvas */}
          <div className="flex-1 min-w-0 overflow-auto p-4" style={{ background: isNight ? '#0a0a1a' : 'hsl(var(--background))' }}>
            {activeMap ? (
              <div className="relative">
                {/* Night atmosphere indicator */}
                {isNight && (
                  <div className="mb-2 flex items-center gap-2">
                    <div className="text-[10px] font-bold uppercase px-2 py-0.5 border-2 border-accent text-accent pixel-blink">
                      {t('mapeditor.night_preview_mode')}
                    </div>
                    <span className="text-[9px] text-muted-foreground">{t('mapeditor.night_hint', '格子显示夜间形态，底部色条为昼/夜对比')}</span>
                  </div>
                )}
                {/* Grid */}
                <div style={{ display: 'inline-block' }}>
                  {Array.from({ length: activeMap.height }, (_, y) => (
                    <div key={y} style={{ display: 'flex' }}>
                      {Array.from({ length: activeMap.width }, (_, x) => {
                        const tile = activeMap.tiles.find(t => t.x === x && t.y === y);
                        if (tile) {
                          return (
                            <TileBlock
                              key={`${x}-${y}`}
                              tile={tile}
                              isSelected={selectedTileId === tile.id}
                              isNight={isNight}
                              onClick={() => setSelectedTileId(tile.id)}
                              onRightClick={e => handleRightClick(e, tile.id)}
                              t={t}
                            />
                          );
                        }
                        return <EmptyCell key={`${x}-${y}`} x={x} y={y} isNight={isNight} onClick={() => handleCellClick(x, y)} t={t} />;
                      })}
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-muted-foreground text-[10px]">
                  {t('mapeditor.canvas_hint').replace('{placed}', String(activeMap.tiles.length)).replace('{total}', String(activeMap.width * activeMap.height))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64">
                <div className="text-muted-foreground text-xs uppercase">{t('mapeditor.select_or_create_map')}</div>
              </div>
            )}
          </div>

          {/* Right: Inspector + Paint selector */}
          <div className="w-56 shrink-0 bg-sidebar border-l-2 border-sidebar-border flex flex-col overflow-hidden">
            {/* Paint selector */}
            <div className="p-2 border-b border-sidebar-border shrink-0">
              <div className="text-accent text-[10px] uppercase font-bold mb-1.5">{t('mapeditor.brush_type')}</div>
              <div className="flex flex-wrap gap-1">
                {(tileTemplates.length > 0
                  ? tileTemplates.map(t => ({ value: t.day_type, label: t.name, color: t.color }))
                  : Object.entries(DAY_COLORS).slice(0, 12).map(([k, v]) => ({ value: k, label: k, color: v }))
                ).map(opt => (
                  <button
                    key={opt.value}
                    className={`text-[9px] font-bold px-1.5 py-0.5 border-2 uppercase
                      ${paintTileType === opt.value ? 'border-primary text-primary bg-secondary' : 'border-border text-muted-foreground hover:border-muted-foreground'}
                    `}
                    style={{ borderLeftColor: opt.color, borderLeftWidth: 4 }}
                    onClick={() => setPaintTileType(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Inspector */}
            {selectedTile ? (
              <TileInspector
                tile={selectedTile}
                isNight={isNight}
                allTiles={activeMap?.tiles ?? []}
                onUpdate={updateSelectedTile}
                onDelete={deleteSelectedTile}
                t={t}
              />
            ) : (
              <div className="p-3 text-muted-foreground text-[10px] text-center flex-1 flex flex-col items-center justify-center gap-1">
                <span className="text-2xl opacity-30">□</span>
                <span>{t('mapeditor.no_selection')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
