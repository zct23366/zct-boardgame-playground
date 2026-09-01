import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useProject } from '@/contexts/ProjectContext';
import { getProjects, createProject, deleteProject, updateProject } from '@/lib/api';
import type { Project } from '@/types/types';
import MainLayout from '@/components/layouts/MainLayout';

export default function ProjectsPage() {
  const { currentProject, setCurrentProject, t } = useProject();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (e) {
      toast.error(t('project.load_failed', '加载项目失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error(t('project.name_ph')); return; }
    setCreating(true);
    try {
      const p = await createProject(newName.trim(), newDesc.trim());
      setProjects(prev => [p, ...prev]);
      setNewName('');
      setNewDesc('');
      toast.success(t('project.created_toast'));
    } catch {
      toast.error(t('project.create_failed', '创建项目失败'));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`${t('project.delete_confirm')} "${name}"`)) return;
    try {
      await deleteProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));
      if (currentProject?.id === id) setCurrentProject(null);
      toast.success(t('project.deleted_toast'));
    } catch {
      toast.error(t('project.delete_failed', '删除失败'));
    }
  };

  const handleEdit = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await updateProject(id, { name: editName.trim() });
      setProjects(prev => prev.map(p => p.id === id ? { ...p, name: editName.trim() } : p));
      if (currentProject?.id === id) setCurrentProject({ ...currentProject!, name: editName.trim() });
      setEditId(null);
      toast.success(t('project.updated_toast', '已更新'));
    } catch {
      toast.error(t('project.update_failed', '更新失败'));
    }
  };

  return (
    <MainLayout>
      <div className="p-4 flex flex-col gap-4 min-h-0">
        {/* Header */}
        <div className="pixel-card p-3 flex items-center gap-2">
          <span className="text-primary text-lg">■</span>
          <h1 className="text-foreground text-sm font-bold uppercase tracking-widest">{t('project.title')}</h1>
        </div>

        {/* Create form */}
        <div className="pixel-card p-4">
          <div className="text-accent text-xs uppercase font-bold mb-3">▶ {t('project.new')}</div>
          <div className="flex flex-col md:flex-row gap-2">
            <input
              className="pixel-inset bg-input text-foreground text-xs px-3 py-2 flex-1 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={t('project.name_ph')}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
            <input
              className="pixel-inset bg-input text-foreground text-xs px-3 py-2 flex-1 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={t('project.desc_ph')}
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
            />
            <button
              className="pixel-btn bg-primary text-primary-foreground text-xs font-bold uppercase px-4 py-2 shrink-0"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? '...' : t('common.create')}
            </button>
          </div>
        </div>

        {/* Projects list */}
        <div className="pixel-card flex-1 min-h-0 overflow-y-auto">
          <div className="text-accent text-xs uppercase font-bold p-3 border-b border-border">
            ▶ {t('project.list', '项目列表')} ({projects.length})
          </div>
          {loading ? (
            <div className="p-6 text-center text-muted-foreground text-xs uppercase">
              <span className="pixel-blink">■</span> {t('common.loading')}
            </div>
          ) : projects.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-xs uppercase">
              {t('project.empty', '暂无项目，请创建一个新项目开始')}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {projects.map(project => (
                <div
                  key={project.id}
                  className={`p-3 flex items-center gap-3 transition-none hover:bg-secondary/30
                    ${currentProject?.id === project.id ? 'bg-secondary/40 border-l-4 border-l-primary' : ''}
                  `}
                >
                  <div className="flex-1 min-w-0">
                    {editId === project.id ? (
                      <div className="flex gap-2">
                        <input
                          className="pixel-inset bg-input text-foreground text-xs px-2 py-1 flex-1 focus:outline-none"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleEdit(project.id); if (e.key === 'Escape') setEditId(null); }}
                          autoFocus
                        />
                        <button className="pixel-btn bg-primary text-primary-foreground text-[10px] px-2 py-1 uppercase font-bold" onClick={() => handleEdit(project.id)}>{t('common.confirm')}</button>
                        <button className="pixel-btn bg-secondary text-secondary-foreground text-[10px] px-2 py-1 uppercase font-bold" onClick={() => setEditId(null)}>{t('common.cancel')}</button>
                      </div>
                    ) : (
                      <>
                        <div className="text-xs font-bold text-foreground truncate">
                          {currentProject?.id === project.id && <span className="text-primary mr-1">▶</span>}
                          {project.name}
                        </div>
                        {project.description && (
                          <div className="text-[10px] text-muted-foreground truncate mt-0.5">{project.description}</div>
                        )}
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {t('project.created')}: {new Date(project.created_at).toLocaleString('zh-CN')}
                        </div>
                      </>
                    )}
                  </div>

                  {editId !== project.id && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        className="pixel-btn bg-primary text-primary-foreground text-[10px] font-bold uppercase px-2 py-1"
                        onClick={() => setCurrentProject(project)}
                      >
                        {t('project.select', '选择')}
                      </button>
                      <Link
                        to="/map-editor"
                        className="pixel-btn bg-accent text-accent-foreground text-[10px] font-bold uppercase px-2 py-1 inline-block"
                        onClick={() => setCurrentProject(project)}
                      >
                        {t('common.edit')}
                      </Link>
                      <button
                        className="pixel-btn bg-secondary text-secondary-foreground text-[10px] font-bold uppercase px-2 py-1"
                        onClick={() => { setEditId(project.id); setEditName(project.name); }}
                      >
                        {t('project.rename', '改名')}
                      </button>
                      <button
                        className="pixel-btn bg-destructive text-destructive-foreground text-[10px] font-bold uppercase px-2 py-1"
                        onClick={() => handleDelete(project.id, project.name)}
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
