import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useProject } from '@/contexts/ProjectContext';
import {
  getTileTemplates, createTileTemplate, updateTileTemplate, deleteTileTemplate,
  getBuildingTemplates, createBuildingTemplate, updateBuildingTemplate, deleteBuildingTemplate,
  getEventTemplates, createEventTemplate, updateEventTemplate, deleteEventTemplate,
} from '@/lib/api';
import type { TileTemplate, BuildingTemplate, EventTemplate, EventAction } from '@/types/types';
import { TILE_TYPE_OPTIONS, TRIGGER_OPTIONS, ACTION_OPTIONS } from '@/types/types';
import MainLayout from '@/components/layouts/MainLayout';

type Tab = 'tiles' | 'buildings' | 'events';

export default function RuleEditorPage() {
  const { currentProject, tileTemplates, setTileTemplates, buildingTemplates, setBuildingTemplates, eventTemplates, setEventTemplates, t } = useProject();
  const [activeTab, setActiveTab] = useState<Tab>('tiles');
  const [loading, setLoading] = useState(false);

  const loadAll = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const [tt, bt, et] = await Promise.all([
        getTileTemplates(currentProject.id),
        getBuildingTemplates(currentProject.id),
        getEventTemplates(currentProject.id),
      ]);
      setTileTemplates(tt);
      setBuildingTemplates(bt);
      setEventTemplates(et);
    } catch { toast.error(t('rule.load_failed', '加载数据失败')); }
    finally { setLoading(false); }
  }, [currentProject, t]);

  useEffect(() => { loadAll(); }, [loadAll]);

  if (!currentProject) {
    return (
      <MainLayout>
        <div className="flex-1 flex items-center justify-center">
          <div className="pixel-card p-6 text-center text-muted-foreground text-xs uppercase">{t('mapeditor.select_project_first')}</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex flex-col h-full overflow-hidden">
        <div className="pixel-card border-b-2 border-border p-2 flex items-center gap-2 shrink-0">
          <span className="text-accent text-xs font-bold uppercase">{t('rule.title')}</span>
          <span className="text-muted-foreground text-[10px]">— {currentProject.name}</span>
        </div>

        {/* Tabs */}
        <div className="flex border-b-2 border-border shrink-0">
          {([
            { key: 'tiles', label: t('rule.tab_tiles', '格子模板') },
            { key: 'buildings', label: t('rule.tab_buildings', '建筑模板') },
            { key: 'events', label: t('rule.tab_events', '事件模板') },
          ] as const).map(tab => (
            <button
              key={tab.key}
              className={`px-4 py-2 text-xs font-bold uppercase border-r border-border transition-none
                ${activeTab === tab.key ? 'bg-secondary text-primary border-b-2 border-b-primary' : 'text-muted-foreground hover:bg-secondary/30'}
              `}
              onClick={() => setActiveTab(tab.key)}
            >
              {activeTab === tab.key && <span className="mr-1">▶</span>}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {activeTab === 'tiles' && <TileTemplatesTab projectId={currentProject.id} templates={tileTemplates} setTemplates={setTileTemplates} />}
          {activeTab === 'buildings' && <BuildingTemplatesTab projectId={currentProject.id} templates={buildingTemplates} setTemplates={setBuildingTemplates} />}
          {activeTab === 'events' && <EventTemplatesTab projectId={currentProject.id} templates={eventTemplates} setTemplates={setEventTemplates} />}
        </div>
      </div>
    </MainLayout>
  );
}

// ── Tile Templates ─────────────────────────────────────────────────────────────
function TileTemplatesTab({ projectId, templates, setTemplates }: {
  projectId: string; templates: TileTemplate[]; setTemplates: (t: TileTemplate[]) => void;
}) {
  const { t } = useProject();
  const empty = (): Omit<TileTemplate, 'id' | 'created_at'> => ({
    project_id: projectId, name: '', day_type: 'Forest', night_type: 'Ruins',
    color: '#22c55e', icon: '', can_stop: true, can_build: false,
    has_event: false, charge_at_night: false, replaceable: false, replace_list: [],
  });
  const [form, setForm] = useState(empty());
  const [editId, setEditId] = useState<string | null>(null);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error(t('rule.enter_name')); return; }
    try {
      if (editId) {
        await updateTileTemplate(editId, form);
        setTemplates(templates.map(tp => tp.id === editId ? { ...tp, ...form } : tp));
        toast.success(t('rule.updated_toast'));
      } else {
        const created = await createTileTemplate(form);
        setTemplates([...templates, created]);
        toast.success(t('rule.created_toast'));
      }
      setForm(empty()); setEditId(null);
    } catch { toast.error(t('rule.operation_failed')); }
  };

  const handleEdit = (tp: TileTemplate) => {
    setEditId(tp.id);
    setForm({ project_id: tp.project_id, name: tp.name, day_type: tp.day_type, night_type: tp.night_type, color: tp.color, icon: tp.icon, can_stop: tp.can_stop, can_build: tp.can_build, has_event: tp.has_event, charge_at_night: tp.charge_at_night, replaceable: tp.replaceable, replace_list: tp.replace_list });
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('common.confirm_delete'))) return;
    await deleteTileTemplate(id);
    setTemplates(templates.filter(tp => tp.id !== id));
    toast.success(t('rule.deleted_toast'));
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Form */}
      <div className="pixel-card p-4">
        <div className="text-accent text-xs uppercase font-bold mb-3">{editId ? t('rule.edit_tile_template') : t('rule.new_tile_template')}</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          <Field label={t('rule.name')} value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} />
          <SelectField label={t('rule.day_type')} value={form.day_type} options={TILE_TYPE_OPTIONS} onChange={v => setForm(p => ({ ...p, day_type: v }))} />
          <SelectField label={t('rule.night_type')} value={form.night_type} options={TILE_TYPE_OPTIONS} onChange={v => setForm(p => ({ ...p, night_type: v }))} />
          <div>
            <label className="text-[10px] text-muted-foreground uppercase block mb-1">{t('rule.color')}</label>
            <input type="color" className="w-full h-8 pixel-inset cursor-pointer" value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))} />
          </div>
        </div>
        <div className="flex flex-wrap gap-4 mb-3">
          <Checkbox label={t('rule.can_stop')} checked={form.can_stop} onChange={v => setForm(p => ({ ...p, can_stop: v }))} />
          <Checkbox label={t('rule.can_build')} checked={form.can_build} onChange={v => setForm(p => ({ ...p, can_build: v }))} />
          <Checkbox label={t('rule.has_event')} checked={form.has_event} onChange={v => setForm(p => ({ ...p, has_event: v }))} />
          <Checkbox label={t('rule.charge_night')} checked={form.charge_at_night} onChange={v => setForm(p => ({ ...p, charge_at_night: v }))} />
          <Checkbox label={t('rule.replaceable')} checked={form.replaceable} onChange={v => setForm(p => ({ ...p, replaceable: v }))} />
        </div>
        <div className="flex gap-2">
          <button className="pixel-btn bg-primary text-primary-foreground text-xs font-bold uppercase px-3 py-1.5" onClick={handleSave}>{editId ? t('common.update') : t('common.create')}</button>
          {editId && <button className="pixel-btn bg-secondary text-secondary-foreground text-xs font-bold uppercase px-3 py-1.5" onClick={() => { setForm(empty()); setEditId(null); }}>{t('common.cancel')}</button>}
        </div>
      </div>

      {/* List */}
      <div className="pixel-card overflow-hidden">
        <div className="text-accent text-xs font-bold uppercase p-3 border-b border-border">{t('rule.tile_list')} ({templates.length})</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
            <thead>
              <tr className="border-b border-border">
                {[t('rule.name'), t('rule.day_type'), t('rule.night_type'), t('rule.color'), t('common.attr'), t('common.actions')].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {templates.map(tp => (
                <tr key={tp.id} className="border-b border-border/50 hover:bg-secondary/20">
                  <td className="px-3 py-2 text-xs font-bold whitespace-nowrap">{tp.name}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{tp.day_type}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{tp.night_type}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="w-5 h-5 border-2 border-border inline-block" style={{ backgroundColor: tp.color }} />
                  </td>
                  <td className="px-3 py-2 text-[10px] text-muted-foreground whitespace-nowrap">
                    {[tp.can_stop && t('rule.badge_stop'), tp.can_build && t('rule.badge_build'), tp.has_event && t('rule.badge_event'), tp.charge_at_night && '¥'].filter(Boolean).join(' ')}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex gap-1">
                      <button className="pixel-btn bg-accent text-accent-foreground text-[10px] font-bold px-2 py-0.5" onClick={() => handleEdit(tp)}>{t('common.edit')}</button>
                      <button className="pixel-btn bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5" onClick={() => handleDelete(tp.id)}>{t('common.delete')}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {templates.length === 0 && <div className="p-4 text-center text-muted-foreground text-xs">{t('rule.no_tile_template')}</div>}
        </div>
      </div>
    </div>
  );
}

// ── Building Templates ─────────────────────────────────────────────────────────
function BuildingTemplatesTab({ projectId, templates, setTemplates }: {
  projectId: string; templates: BuildingTemplate[]; setTemplates: (t: BuildingTemplate[]) => void;
}) {
  const { t } = useProject();
  const empty = (): Omit<BuildingTemplate, 'id' | 'created_at'> => ({
    project_id: projectId, type: 'Camp', level: 1,
    cost_wood: 1, cost_stone: 0, cost_rice: 0,
    effect_day: '', effect_night: '', can_collect: false,
  });
  const [form, setForm] = useState(empty());
  const [editId, setEditId] = useState<string | null>(null);

  const handleSave = async () => {
    if (!form.type.trim()) { toast.error(t('rule.enter_building_type')); return; }
    try {
      if (editId) {
        await updateBuildingTemplate(editId, form);
        setTemplates(templates.map(tp => tp.id === editId ? { ...tp, ...form } : tp));
        toast.success(t('rule.updated_toast'));
      } else {
        const created = await createBuildingTemplate(form);
        setTemplates([...templates, created]);
        toast.success(t('rule.created_toast'));
      }
      setForm(empty()); setEditId(null);
    } catch { toast.error(t('rule.operation_failed')); }
  };

  const handleEdit = (tp: BuildingTemplate) => {
    setEditId(tp.id);
    setForm({ project_id: tp.project_id, type: tp.type, level: tp.level, cost_wood: tp.cost_wood, cost_stone: tp.cost_stone, cost_rice: tp.cost_rice, effect_day: tp.effect_day, effect_night: tp.effect_night, can_collect: tp.can_collect });
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('common.confirm_delete'))) return;
    await deleteBuildingTemplate(id);
    setTemplates(templates.filter(tp => tp.id !== id));
    toast.success(t('rule.deleted_toast'));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="pixel-card p-4">
        <div className="text-accent text-xs uppercase font-bold mb-3">{editId ? t('rule.edit_building') : t('rule.new_building')}</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          <Field label={t('rule.building_type')} value={form.type} onChange={v => setForm(p => ({ ...p, type: v }))} />
          <NumberField label={t('rule.level')} value={form.level} onChange={v => setForm(p => ({ ...p, level: v }))} min={1} max={10} />
          <NumberField label={t('rule.cost_wood')} value={form.cost_wood} onChange={v => setForm(p => ({ ...p, cost_wood: v }))} min={0} />
          <NumberField label={t('rule.cost_stone')} value={form.cost_stone} onChange={v => setForm(p => ({ ...p, cost_stone: v }))} min={0} />
          <NumberField label={t('rule.cost_rice')} value={form.cost_rice} onChange={v => setForm(p => ({ ...p, cost_rice: v }))} min={0} />
          <Field label={t('rule.effect_day')} value={form.effect_day} onChange={v => setForm(p => ({ ...p, effect_day: v }))} />
          <Field label={t('rule.effect_night')} value={form.effect_night} onChange={v => setForm(p => ({ ...p, effect_night: v }))} />
        </div>
        <div className="flex items-center gap-4 mb-3">
          <Checkbox label={t('rule.can_collect')} checked={form.can_collect} onChange={v => setForm(p => ({ ...p, can_collect: v }))} />
        </div>
        <div className="flex gap-2">
          <button className="pixel-btn bg-primary text-primary-foreground text-xs font-bold uppercase px-3 py-1.5" onClick={handleSave}>{editId ? t('common.update') : t('common.create')}</button>
          {editId && <button className="pixel-btn bg-secondary text-secondary-foreground text-xs font-bold uppercase px-3 py-1.5" onClick={() => { setForm(empty()); setEditId(null); }}>{t('common.cancel')}</button>}
        </div>
      </div>

      <div className="pixel-card overflow-hidden">
        <div className="text-accent text-xs font-bold uppercase p-3 border-b border-border">{t('rule.building_list')} ({templates.length})</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
            <thead>
              <tr className="border-b border-border">
                {[t('rule.building_type'), t('rule.level'), t('common.cost'), t('rule.effect_day'), t('rule.effect_night'), t('common.charge'), t('common.actions')].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {templates.map(tp => (
                <tr key={tp.id} className="border-b border-border/50 hover:bg-secondary/20">
                  <td className="px-3 py-2 text-xs font-bold whitespace-nowrap">{tp.type}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">Lv.{tp.level}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{tp.cost_wood}/{tp.cost_stone}/{tp.cost_rice}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap max-w-24 truncate">{tp.effect_day || '-'}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap max-w-24 truncate">{tp.effect_night || '-'}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{tp.can_collect ? t('common.yes') : t('common.no')}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex gap-1">
                      <button className="pixel-btn bg-accent text-accent-foreground text-[10px] font-bold px-2 py-0.5" onClick={() => handleEdit(tp)}>{t('common.edit')}</button>
                      <button className="pixel-btn bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5" onClick={() => handleDelete(tp.id)}>{t('common.delete')}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {templates.length === 0 && <div className="p-4 text-center text-muted-foreground text-xs">{t('rule.no_building_template')}</div>}
        </div>
      </div>
    </div>
  );
}

// ── Event Templates ─────────────────────────────────────────────────────────────
function EventTemplatesTab({ projectId, templates, setTemplates }: {
  projectId: string; templates: EventTemplate[]; setTemplates: (t: EventTemplate[]) => void;
}) {
  const { t } = useProject();
  const emptyAction = (): EventAction => ({ type: 'addResource', resource: 'wood', amount: 1 });
  const empty = (): Omit<EventTemplate, 'id' | 'created_at'> => ({
    project_id: projectId, name: '', trigger: 'enterTile',
    condition: {}, actions: [emptyAction()],
  });
  const [form, setForm] = useState(empty());
  const [editId, setEditId] = useState<string | null>(null);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error(t('rule.enter_event_name')); return; }
    try {
      if (editId) {
        await updateEventTemplate(editId, form);
        setTemplates(templates.map(tp => tp.id === editId ? { ...tp, ...form } : tp));
        toast.success(t('rule.updated_toast'));
      } else {
        const created = await createEventTemplate(form);
        setTemplates([...templates, created]);
        toast.success(t('rule.created_toast'));
      }
      setForm(empty()); setEditId(null);
    } catch { toast.error(t('rule.operation_failed')); }
  };

  const handleEdit = (tp: EventTemplate) => {
    setEditId(tp.id);
    setForm({ project_id: tp.project_id, name: tp.name, trigger: tp.trigger as any, condition: tp.condition, actions: tp.actions });
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('common.confirm_delete'))) return;
    await deleteEventTemplate(id);
    setTemplates(templates.filter(tp => tp.id !== id));
    toast.success(t('rule.deleted_toast'));
  };

  const updateAction = (i: number, updates: Partial<EventAction>) => {
    setForm(p => ({ ...p, actions: p.actions.map((a, idx) => idx === i ? { ...a, ...updates } : a) }));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="pixel-card p-4">
        <div className="text-accent text-xs uppercase font-bold mb-3">{editId ? t('rule.edit_event') : t('rule.new_event')}</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
          <Field label={t('rule.event_name')} value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} />
          <SelectField label={t('rule.trigger')} value={form.trigger} options={TRIGGER_OPTIONS.map(o => o.value)} labels={TRIGGER_OPTIONS.map(o => o.label)} onChange={v => setForm(p => ({ ...p, trigger: v }))} />
          <div>
            <label className="text-[10px] text-muted-foreground uppercase block mb-1">{t('rule.condition')}</label>
            <input
              className="pixel-inset bg-input text-foreground text-[10px] px-2 py-1.5 w-full focus:outline-none"
              placeholder='{"tileType":"Forest"}'
              value={JSON.stringify(form.condition)}
              onChange={e => { try { setForm(p => ({ ...p, condition: JSON.parse(e.target.value) })); } catch {} }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mb-3">
          <div className="text-[10px] text-muted-foreground uppercase mb-1">{t('rule.action_list')}</div>
          {form.actions.map((action, i) => (
            <div key={i} className="flex gap-2 mb-1 items-center flex-wrap">
              <SelectField label="" value={action.type} options={ACTION_OPTIONS.map(o => o.value)} labels={ACTION_OPTIONS.map(o => o.label)} onChange={v => updateAction(i, { type: v as any })} />
              {(action.type === 'addResource' || action.type === 'stealResource' || action.type === 'taxCollect') && (
                <>
                  <SelectField label="" value={action.resource || 'wood'} options={['wood', 'stone', 'rice']} labels={[t('common.wood'), t('common.stone'), t('common.rice')]} onChange={v => updateAction(i, { resource: v })} />
                  <input type="number" min={0} className="pixel-inset bg-input text-foreground text-[10px] px-2 py-1 w-16 focus:outline-none" value={action.amount ?? 1} onChange={e => updateAction(i, { amount: parseInt(e.target.value) || 0 })} />
                </>
              )}
              {action.type === 'replaceTile' && (
                <SelectField label="" value={action.newType || 'Ruins'} options={TILE_TYPE_OPTIONS} onChange={v => updateAction(i, { newType: v })} />
              )}
              {action.type === 'diceBattle' && (
                <>
                  <SelectField label="" value={action.resource || 'rice'} options={['wood', 'stone', 'rice']} labels={[t('common.wood'), t('common.stone'), t('common.rice')]} onChange={v => updateAction(i, { resource: v })} />
                  <input type="number" min={0} max={100} className="pixel-inset bg-input text-foreground text-[10px] px-2 py-1 w-16 focus:outline-none" placeholder="%" value={action.percentage ?? 50} onChange={e => updateAction(i, { percentage: parseInt(e.target.value) || 0 })} />
                  <span className="text-muted-foreground text-[10px]">%</span>
                </>
              )}
              <button className="text-destructive text-[10px] font-bold px-1 hover:text-red-400" onClick={() => setForm(p => ({ ...p, actions: p.actions.filter((_, idx) => idx !== i) }))}>✕</button>
            </div>
          ))}
          <button className="pixel-btn bg-secondary text-secondary-foreground text-[10px] font-bold uppercase px-2 py-1 mt-1" onClick={() => setForm(p => ({ ...p, actions: [...p.actions, emptyAction()] }))}>{t('rule.add_action')}</button>
        </div>

        <div className="flex gap-2">
          <button className="pixel-btn bg-primary text-primary-foreground text-xs font-bold uppercase px-3 py-1.5" onClick={handleSave}>{editId ? t('common.update') : t('common.create')}</button>
          {editId && <button className="pixel-btn bg-secondary text-secondary-foreground text-xs font-bold uppercase px-3 py-1.5" onClick={() => { setForm(empty()); setEditId(null); }}>{t('common.cancel')}</button>}
        </div>
      </div>

      <div className="pixel-card overflow-hidden">
        <div className="text-accent text-xs font-bold uppercase p-3 border-b border-border">{t('rule.event_list')} ({templates.length})</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
            <thead>
              <tr className="border-b border-border">
                {[t('rule.name'), t('rule.trigger'), t('common.action_count'), t('common.actions')].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {templates.map(tp => (
                <tr key={tp.id} className="border-b border-border/50 hover:bg-secondary/20">
                  <td className="px-3 py-2 text-xs font-bold whitespace-nowrap">{tp.name}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap text-accent">{tp.trigger}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{tp.actions.length}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex gap-1">
                      <button className="pixel-btn bg-accent text-accent-foreground text-[10px] font-bold px-2 py-0.5" onClick={() => handleEdit(tp)}>{t('common.edit')}</button>
                      <button className="pixel-btn bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5" onClick={() => handleDelete(tp.id)}>{t('common.delete')}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {templates.length === 0 && <div className="p-4 text-center text-muted-foreground text-xs">{t('rule.no_event_template')}</div>}
        </div>
      </div>
    </div>
  );
}

// Helpers
function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      {label && <label className="text-[10px] text-muted-foreground uppercase block mb-1">{label}</label>}
      <input className="pixel-inset bg-input text-foreground text-[10px] px-2 py-1.5 w-full focus:outline-none" value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
function NumberField({ label, value, onChange, min = 0, max }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div>
      <label className="text-[10px] text-muted-foreground uppercase block mb-1">{label}</label>
      <input type="number" min={min} max={max} className="pixel-inset bg-input text-foreground text-[10px] px-2 py-1.5 w-full focus:outline-none" value={value} onChange={e => onChange(parseInt(e.target.value) || 0)} />
    </div>
  );
}
function SelectField({ label, value, options, labels, onChange }: { label: string; value: string; options: string[]; labels?: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      {label && <label className="text-[10px] text-muted-foreground uppercase block mb-1">{label}</label>}
      <select className="pixel-inset bg-input text-foreground text-[10px] px-2 py-1.5 w-full focus:outline-none" value={value} onChange={e => onChange(e.target.value)}>
        {options.map((o, i) => <option key={o} value={o}>{labels?.[i] || o}</option>)}
      </select>
    </div>
  );
}
function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2 cursor-pointer" onClick={() => onChange(!checked)}>
      <div className={`w-4 h-4 border-2 flex items-center justify-center text-[10px] ${checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-input'}`}>
        {checked && '✓'}
      </div>
      <span className="text-xs text-foreground">{label}</span>
    </div>
  );
}
