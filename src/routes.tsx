import type { ReactNode } from 'react';
import ProjectsPage from './pages/ProjectsPage';
import MapEditorPage from './pages/MapEditorPage';
import RuleEditorPage from './pages/RuleEditorPage';
import GameRunnerPage from './pages/GameRunnerPage';
import ReplayPage from './pages/ReplayPage';
import AnalyticsPage from './pages/AnalyticsPage';
import DevToolsPage from './pages/DevToolsPage';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  public?: boolean;
}

export const routes: RouteConfig[] = [
  { name: '项目管理', path: '/', element: <ProjectsPage />, public: true },
  { name: '地图编辑器', path: '/map-editor', element: <MapEditorPage />, public: true },
  { name: '规则编辑器', path: '/rule-editor', element: <RuleEditorPage />, public: true },
  { name: '游戏运行器', path: '/game-runner', element: <GameRunnerPage />, public: true },
  { name: '日志回放', path: '/replay', element: <ReplayPage />, public: true },
  { name: '数据分析', path: '/analytics', element: <AnalyticsPage />, public: true },
  { name: '开发者工具', path: '/dev-tools', element: <DevToolsPage />, public: true },
];
