import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(__dirname);

try {
  const result = execSync(
    `"${process.execPath}" "${join(__dirname, 'node_modules', 'vercel', 'dist', 'vc.js')}" deploy --prod --yes`,
    {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 120000,
      env: { ...process.env, FORCE_COLOR: '1', NODE_ENV: 'development' }
    }
  );
  console.log(result);
} catch (e) {
  console.log('stdout:', e.stdout);
  console.error('stderr:', e.stderr);
  process.exit(e.status || 1);
}
