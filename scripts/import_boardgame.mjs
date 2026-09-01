#!/usr/bin/env node
// Import boardgame app data exported by export_boardgame.mjs into an independent Supabase.
// Usage: node scripts/import_boardgame.mjs <supabase-url> <service-role-key> [export-json]
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const [, , url, serviceRoleKey, exportFile = resolve('miaoda-boardgame-export.json')] = process.argv;

if (!url || !serviceRoleKey) {
  console.error('Usage: node scripts/import_boardgame.mjs <supabase-url> <service-role-key> [export-json]');
  process.exit(1);
}

const data = JSON.parse(readFileSync(exportFile, 'utf8'));
const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

// Order matters because of foreign keys.
const tables = [
  'projects',
  'maps',
  'tile_templates',
  'building_templates',
  'event_templates',
  'game_sessions',
];

async function upsertRows(table, rows) {
  if (!rows || rows.length === 0) {
    console.log(`${table}: 0 rows (skipped)`);
    return;
  }
  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'id' });
    if (!error) continue;

    // Fallback: insert one by one to isolate bad rows.
    console.warn(`${table}: batch upsert failed (${error.message}), retrying row by row...`);
    for (const row of chunk) {
      const { error: rowError } = await supabase.from(table).upsert(row, { onConflict: 'id' });
      if (rowError) {
        console.error(`${table} row ${row.id}: ${rowError.message}`);
      }
    }
  }
  console.log(`${table}: ${rows.length} rows processed`);
}

for (const table of tables) {
  const rows = (data[table] && Array.isArray(data[table].value)) ? data[table].value : data[table];
  await upsertRows(table, rows || []);
}

console.log('\nImport complete.');
