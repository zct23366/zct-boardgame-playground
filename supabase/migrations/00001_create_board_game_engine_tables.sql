
-- Projects table
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Maps table (multiple maps per project)
CREATE TABLE maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '未命名地图',
  width integer NOT NULL DEFAULT 8,
  height integer NOT NULL DEFAULT 8,
  cyclic boolean NOT NULL DEFAULT false,
  tiles jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tile templates
CREATE TABLE tile_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  day_type text NOT NULL DEFAULT 'Empty',
  night_type text NOT NULL DEFAULT 'Empty',
  color text NOT NULL DEFAULT '#6B7280',
  icon text DEFAULT '',
  can_stop boolean NOT NULL DEFAULT true,
  can_build boolean NOT NULL DEFAULT false,
  has_event boolean NOT NULL DEFAULT false,
  charge_at_night boolean NOT NULL DEFAULT false,
  replaceable boolean NOT NULL DEFAULT false,
  replace_list jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Building templates
CREATE TABLE building_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type text NOT NULL,
  level integer NOT NULL DEFAULT 1,
  cost_wood integer NOT NULL DEFAULT 0,
  cost_stone integer NOT NULL DEFAULT 0,
  cost_rice integer NOT NULL DEFAULT 0,
  effect_day text DEFAULT '',
  effect_night text DEFAULT '',
  can_collect boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Event templates
CREATE TABLE event_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger text NOT NULL DEFAULT 'enterTile',
  condition jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Game sessions
CREATE TABLE game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  map_id uuid NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '游戏',
  players jsonb NOT NULL DEFAULT '[]'::jsonb,
  game_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  logs jsonb NOT NULL DEFAULT '[]'::jsonb,
  seed bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE tile_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE building_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies (public access - no auth required for this platform)
CREATE POLICY "anon_all_projects" ON projects FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_maps" ON maps FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_tile_templates" ON tile_templates FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_building_templates" ON building_templates FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_event_templates" ON event_templates FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_game_sessions" ON game_sessions FOR ALL TO anon USING (true) WITH CHECK (true);

-- Update triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER maps_updated_at BEFORE UPDATE ON maps FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER game_sessions_updated_at BEFORE UPDATE ON game_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Insert sample project with default data
INSERT INTO projects (id, name, description) VALUES
  ('11111111-1111-1111-1111-111111111111', '昼夜繁荣示例项目', '官方示例：包含完整的昼夜切换地图与规则配置');

INSERT INTO maps (project_id, name, width, height, tiles) VALUES
  ('11111111-1111-1111-1111-111111111111', '示例地图', 8, 6,
   '[{"id":"t1","name":"森林","x":1,"y":1,"dayType":"Forest","nightType":"Ruins","color":"#22c55e","canStop":true,"canBuild":false,"hasEvent":false,"chargeAtNight":false,"replaceable":true,"replaceList":["Ruins"]},
    {"id":"t2","name":"矿山","x":2,"y":1,"dayType":"Mine","nightType":"Bandit","color":"#78716c","canStop":true,"canBuild":false,"hasEvent":false,"chargeAtNight":false,"replaceable":false,"replaceList":[]},
    {"id":"t3","name":"市场","x":3,"y":1,"dayType":"Market","nightType":"NightMarket","color":"#f59e0b","canStop":true,"canBuild":false,"hasEvent":false,"chargeAtNight":true,"replaceable":false,"replaceList":[]},
    {"id":"t4","name":"村庄","x":4,"y":1,"dayType":"Village","nightType":"CollectFee","color":"#3b82f6","canStop":true,"canBuild":true,"hasEvent":false,"chargeAtNight":true,"replaceable":false,"replaceList":[]},
    {"id":"t5","name":"空地","x":5,"y":1,"dayType":"Empty","nightType":"Empty","color":"#d1d5db","canStop":true,"canBuild":true,"hasEvent":false,"chargeAtNight":false,"replaceable":true,"replaceList":["Forest","Mine"]}]'::jsonb);

INSERT INTO tile_templates (project_id, name, day_type, night_type, color, can_stop, can_build, has_event, charge_at_night, replaceable) VALUES
  ('11111111-1111-1111-1111-111111111111', '森林', 'Forest', 'Ruins', '#22c55e', true, false, false, false, true),
  ('11111111-1111-1111-1111-111111111111', '矿山', 'Mine', 'Bandit', '#78716c', true, false, false, false, false),
  ('11111111-1111-1111-1111-111111111111', '市场', 'Market', 'NightMarket', '#f59e0b', true, false, false, true, false),
  ('11111111-1111-1111-1111-111111111111', '村庄', 'Village', 'CollectFee', '#3b82f6', true, true, false, true, false),
  ('11111111-1111-1111-1111-111111111111', '空地', 'Empty', 'Empty', '#d1d5db', true, true, false, false, true);

INSERT INTO building_templates (project_id, type, level, cost_wood, cost_stone, cost_rice, effect_day, effect_night, can_collect) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Camp', 1, 1, 0, 0, '免夜晚攻击', '-', false),
  ('11111111-1111-1111-1111-111111111111', 'Village', 2, 2, 1, 0, '过路费+木材1', '夜间收税', true),
  ('11111111-1111-1111-1111-111111111111', 'City', 3, 3, 2, 1, '过路费+石材2', '夜间收税', true);

INSERT INTO event_templates (project_id, name, trigger, condition, actions) VALUES
  ('11111111-1111-1111-1111-111111111111', '森林采集', 'enterTile', '{"tileType":"Forest"}'::jsonb, '[{"type":"addResource","resource":"wood","amount":1}]'::jsonb),
  ('11111111-1111-1111-1111-111111111111', '矿山开采', 'enterTile', '{"tileType":"Mine"}'::jsonb, '[{"type":"addResource","resource":"stone","amount":1}]'::jsonb),
  ('11111111-1111-1111-1111-111111111111', '夜间盗贼', 'nightStart', '{"tileType":"Bandit"}'::jsonb, '[{"type":"stealResource","resource":"wood","amount":2}]'::jsonb),
  ('11111111-1111-1111-1111-111111111111', '战斗对决', 'sameTile', '{}'::jsonb, '[{"type":"diceBattle","loseResource":"rice","percentage":50}]'::jsonb);
