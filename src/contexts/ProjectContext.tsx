import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Project, GameMap, TileTemplate, BuildingTemplate, EventTemplate } from '@/types/types';
import { translate, type Language } from '@/lib/i18n';

interface ProjectContextValue {
  currentProject: Project | null;
  currentMap: GameMap | null;
  setCurrentProject: (p: Project | null) => void;
  setCurrentMap: (m: GameMap | null) => void;
  tileTemplates: TileTemplate[];
  buildingTemplates: BuildingTemplate[];
  eventTemplates: EventTemplate[];
  setTileTemplates: (t: TileTemplate[]) => void;
  setBuildingTemplates: (b: BuildingTemplate[]) => void;
  setEventTemplates: (e: EventTemplate[]) => void;
  devMode: boolean;
  setDevMode: (v: boolean) => void;
  randomSeed: number;
  setRandomSeed: (v: number) => void;
  language: Language;
  setLanguage: (l: Language) => void;
  t: (key: string, fallback?: string) => string;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [currentMap, setCurrentMap] = useState<GameMap | null>(null);
  const [tileTemplates, setTileTemplates] = useState<TileTemplate[]>([]);
  const [buildingTemplates, setBuildingTemplates] = useState<BuildingTemplate[]>([]);
  const [eventTemplates, setEventTemplates] = useState<EventTemplate[]>([]);
  const [devMode, setDevMode] = useState(false);
  const [randomSeed, setRandomSeed] = useState(42);
  const [language, setLanguage] = useState<Language>('zh');

  const t = useCallback((key: string, fallback?: string) => translate(language, key, fallback), [language]);

  return (
    <ProjectContext.Provider value={{
      currentProject, currentMap,
      setCurrentProject, setCurrentMap,
      tileTemplates, buildingTemplates, eventTemplates,
      setTileTemplates, setBuildingTemplates, setEventTemplates,
      devMode, setDevMode,
      randomSeed, setRandomSeed,
      language, setLanguage,
      t,
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
}
