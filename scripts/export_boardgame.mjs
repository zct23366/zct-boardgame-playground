#!/usr/bin/env node
// Export boardgame app data from a Supabase backend to a JSON file.
// Usage: node scripts/export_boardgame.mjs <supabase-url> <anon-key> [output]
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const [, , url, anonKey, output = resolve('miaoda-boardgame-export.json')] = process.argv;

if (!url || !anonKey) {
  console.error('Usage: node scripts/export_boardgame.mjs <supabase-url> <anon-key> [output]');
  process.exit(1);
}

const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
const tables = [
  'projects',
  'maps',
  'tile_templates',
  'building_templates',
  'event_templates',
  'game_sessions',
];

const result = {};

for (const table of tables) {
  const rows = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('id')
      .range(from, from + pageSize - 1);
    if (error) {
      console.error(`${table}: ${error.message}`);
      break;
    }
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  result[table] = rows;
  console.log(`${table}: ${rows.length} rows`);
}

writeFileSync(output, JSON.stringify(result, null, 2), 'utf8');
console.log(`\nSaved to ${output}`);
