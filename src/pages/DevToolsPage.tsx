import React, { useState } from 'react';
import { toast } from 'sonner';
import { useProject } from '@/contexts/ProjectContext';
import { LANGUAGES } from '@/lib/i18n';
import MainLayout from '@/components/layouts/MainLayout';

const getSampleMap = (t: (k: string) => string) => ({
  id: 'sample', name: t('tools.sample_map_name'), project_id: 'sample',
  width: 6, height: 5, cyclic: false,
  tiles: [
    { id: 't1', name: t('tools.tile_forest'), x: 0, y: 0, dayType: 'Forest', nightType: 'Ruins', color: '#22c55e', canStop: true, canBuild: false, hasEvent: false, chargeAtNight: false, replaceable: true, replaceList: [] },
    { id: 't2', name: t('tools.tile_mine'), x: 1, y: 0, dayType: 'Mine', nightType: 'Bandit', color: '#78716c', canStop: true, canBuild: false, hasEvent: false, chargeAtNight: false, replaceable: false, replaceList: [] },
    { id: 't3', name: t('tools.tile_market'), x: 2, y: 0, dayType: 'Market', nightType: 'NightMarket', color: '#f59e0b', canStop: true, canBuild: false, hasEvent: false, chargeAtNight: true, replaceable: false, replaceList: [] },
    { id: 't4', name: t('tools.tile_village'), x: 3, y: 0, dayType: 'Village', nightType: 'CollectFee', color: '#3b82f6', canStop: true, canBuild: true, hasEvent: false, chargeAtNight: true, replaceable: false, replaceList: [] },
    { id: 't5', name: t('tools.tile_empty'), x: 4, y: 0, dayType: 'Empty', nightType: 'Empty', color: '#374151', canStop: true, canBuild: true, hasEvent: false, chargeAtNight: false, replaceable: true, replaceList: [] },
  ],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const getSampleRules = (t: (k: string) => string) => ({
  tiles: [
    { name: t('tools.tile_forest'), dayType: 'Forest', nightType: 'Ruins', color: '#22c55e', canStop: true, canBuild: false },
    { name: t('tools.tile_mine'), dayType: 'Mine', nightType: 'Bandit', color: '#78716c', canStop: true, canBuild: false },
    { name: t('tools.tile_market'), dayType: 'Market', nightType: 'NightMarket', color: '#f59e0b', canStop: true, canBuild: false },
  ],
  buildings: [
    { type: 'Camp', level: 1, cost: { wood: 1, stone: 0, rice: 0 }, effectDay: t('tools.camp_effect_day'), effectNight: '-' },
    { type: 'Village', level: 2, cost: { wood: 2, stone: 1, rice: 0 }, effectDay: t('tools.village_effect_day'), effectNight: t('tools.village_effect_night') },
  ],
  events: [
    { name: t('tools.event_forest_gather'), trigger: 'enterTile', condition: { tileType: 'Forest' }, actions: [{ type: 'addResource', resource: 'wood', amount: 1 }] },
  ],
});

export default function DevToolsPage() {
  const { devMode, setDevMode, randomSeed, setRandomSeed, language, setLanguage, t } = useProject();
  const [logLevel, setLogLevel] = useState<'info' | 'debug' | 'verbose'>('info');
  const [showInternals, setShowInternals] = useState(false);
  const [testSeed, setTestSeed] = useState(randomSeed);
  const [rngResults, setRngResults] = useState<number[]>([]);

  function seededRand(seed: number): () => number {
    let s = seed;
    return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return Math.abs(s) / 0xffffffff; };
  }

  const testRng = () => {
    const rand = seededRand(testSeed);
    const results = Array.from({ length: 10 }, () => Math.round(rand() * 100) / 100);
    setRngResults(results);
  };

  const applyRng = () => {
    setRandomSeed(testSeed);
    toast.success(`${t('tools.random_seed')}: ${testSeed}`);
  };

  const downloadTemplate = (type: 'map' | 'rules') => {
    const data = type === 'map' ? getSampleMap(t) : getSampleRules(t);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template_${type}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('tools.exported_toast'));
  };

  return (
    <MainLayout>
      <div className="flex flex-col h-full overflow-hidden">
        <div className="pixel-card border-b-2 border-border p-2 flex items-center gap-3 shrink-0">
          <span className="text-accent font-bold text-xs uppercase">{t('tools.title')}</span>
          {devMode && <span className="text-accent text-[10px] font-bold pixel-blink">{t('common.dev_mode')}</span>}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">

            {/* Debug mode */}
            <div className="pixel-card p-4">
              <div className="text-accent text-xs uppercase font-bold mb-3">▶ {t('tools.dev_mode')}</div>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`w-12 h-6 border-2 cursor-pointer flex items-center relative transition-none
                    ${devMode ? 'border-primary bg-primary/20' : 'border-border bg-input'}
                  `}
                  onClick={() => { setDevMode(!devMode); toast(devMode ? t('tools.dev_off', '调试模式已关闭') : t('tools.dev_on', '调试模式已开启')); }}
                >
                  <div className={`absolute w-5 h-4 bg-primary transition-none ${devMode ? 'left-6' : 'left-1'}`} />
                </div>
                <span className={`text-xs font-bold ${devMode ? 'text-primary' : 'text-muted-foreground'}`}>
                  {devMode ? t('common.yes') : t('common.no')}
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground flex flex-col gap-0.5">
                {devMode ? (
                  <>
                    <span className="text-primary">✓ {t('tools.dev_feat1', '内部状态可见')}</span>
                    <span className="text-primary">✓ {t('tools.dev_feat2', '资源无限制')}</span>
                    <span className="text-primary">✓ {t('tools.dev_feat3', '可手动触发事件')}</span>
                    <span className="text-primary">✓ {t('tools.dev_feat4', '可跳过夜晚')}</span>
                  </>
                ) : (
                  <>
                    <span>○ {t('tools.dev_feat1', '内部状态隐藏')}</span>
                    <span>○ {t('tools.dev_feat2', '资源正常消耗')}</span>
                    <span>○ {t('tools.dev_feat3', '事件自动触发')}</span>
                  </>
                )}
              </div>
            </div>

            {/* RNG */}
            <div className="pixel-card p-4">
              <div className="text-accent text-xs uppercase font-bold mb-3">▶ {t('tools.random_seed')}</div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-muted-foreground text-[10px] uppercase w-16">{t('tools.current_seed', '当前种子')}:</span>
                <span className="text-primary font-bold text-sm">{randomSeed}</span>
              </div>
              <div className="flex gap-2 mb-3">
                <input
                  type="number"
                  className="pixel-inset bg-input text-foreground text-xs px-2 py-1.5 w-28 focus:outline-none"
                  value={testSeed}
                  onChange={e => setTestSeed(parseInt(e.target.value) || 0)}
                />
                <button className="pixel-btn bg-secondary text-secondary-foreground text-[10px] font-bold uppercase px-2 py-1" onClick={testRng}>{t('tools.test', '测试')}</button>
                <button className="pixel-btn bg-primary text-primary-foreground text-[10px] font-bold uppercase px-2 py-1" onClick={applyRng}>{t('common.confirm')}</button>
                <button className="pixel-btn bg-secondary text-secondary-foreground text-[10px] font-bold uppercase px-2 py-1" onClick={() => { setTestSeed(Math.floor(Math.random() * 999999)); }}>{t('tools.random', '随机')}</button>
              </div>
              {rngResults.length > 0 && (
                <div className="pixel-inset bg-input p-2">
                  <div className="text-muted-foreground text-[10px] mb-1">{t('tools.rng_results', '前10个随机值')}:</div>
                  <div className="flex flex-wrap gap-1">
                    {rngResults.map((r, i) => (
                      <span key={i} className="text-primary font-bold text-[10px]">{r}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Language */}
            <div className="pixel-card p-4">
              <div className="text-accent text-xs uppercase font-bold mb-3">▶ {t('tools.language')}</div>
              <div className="flex gap-2">
                {LANGUAGES.map(l => (
                  <button
                    key={l.value}
                    className={`pixel-btn text-xs font-bold uppercase px-3 py-2
                      ${language === l.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-secondary-foreground'}
                    `}
                    onClick={() => { setLanguage(l.value); toast.success(`${t('tools.language')}: ${l.label}`); }}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <div className="text-muted-foreground text-[10px] mt-2">{t('tools.current_language')}: {LANGUAGES.find(l => l.value === language)?.label}</div>
            </div>

            {/* Log level */}
            <div className="pixel-card p-4">
              <div className="text-accent text-xs uppercase font-bold mb-3">▶ {t('tools.log_level', '日志级别')}</div>
              <div className="flex gap-2">
                {(['info', 'debug', 'verbose'] as const).map(l => (
                  <button
                    key={l}
                    className={`pixel-btn text-[10px] font-bold uppercase px-2 py-1
                      ${logLevel === l ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'}
                    `}
                    onClick={() => { setLogLevel(l); toast.success(`${t('tools.log_level', '日志级别')}: ${l}`); }}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Project templates */}
            <div className="pixel-card p-4 md:col-span-2">
              <div className="text-accent text-xs uppercase font-bold mb-3">▶ {t('tools.templates', '项目模板')}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="pixel-inset bg-input p-3">
                  <div className="text-xs font-bold mb-1">{t('tools.map_template', '示例地图模板')}</div>
                  <div className="text-[10px] text-muted-foreground mb-2">{t('tools.map_template_desc', '包含5种格子类型的6×5地图')}</div>
                  <button className="pixel-btn bg-primary text-primary-foreground text-[10px] font-bold uppercase px-2 py-1" onClick={() => downloadTemplate('map')}>{t('tools.download_json', '下载 JSON')}</button>
                </div>
                <div className="pixel-inset bg-input p-3">
                  <div className="text-xs font-bold mb-1">{t('tools.rules_template', '示例规则模板')}</div>
                  <div className="text-[10px] text-muted-foreground mb-2">{t('tools.rules_template_desc', '包含格子/建筑/事件的完整规则集')}</div>
                  <button className="pixel-btn bg-primary text-primary-foreground text-[10px] font-bold uppercase px-2 py-1" onClick={() => downloadTemplate('rules')}>{t('tools.download_json', '下载 JSON')}</button>
                </div>
              </div>
            </div>

            {/* System info */}
            {devMode && (
              <div className="pixel-card p-4 md:col-span-2">
                <div className="text-accent text-xs uppercase font-bold mb-3">▶ {t('tools.system_info', '系统信息')}</div>
                <div className="pixel-inset bg-input p-3">
                  <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap">
                    {JSON.stringify({
                      platform: t('app.title'),
                      version: '1.0.0',
                      devMode,
                      randomSeed,
                      language,
                      logLevel,
                      userAgent: navigator.userAgent.slice(0, 60) + '...',
                      timestamp: new Date().toISOString(),
                    }, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
