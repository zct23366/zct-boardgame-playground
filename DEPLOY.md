# 独立部署说明（app-ctq7vu3ohczm 桌游 App）

参考：`E:\longxiayong\docs\脱离秒哒独立部署指南.md`。

## 架构

- 前端：Vite + React 静态站点，托管到 Vercel / Cloudflare Pages。
- 后端：独立 Supabase 项目（6 张业务表：`projects`、`maps`、`tile_templates`、`building_templates`、`event_templates`、`game_sessions`）。
- 环境变量：`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`。

## 1. 建独立 Supabase

1. 到 supabase.com 新建项目（免费档即可，不要复用点餐系统的 `occsfgsqshrhhjkzgplz`）。
2. 在 SQL Editor 执行 `supabase/schema.sql`，创建 6 张表、RLS 和触发器。
3. 在 Settings → API 获取：
   - Project URL
   - anon key（前端用）
   - service_role key（导入用，勿放前端）
   - 数据库密码（可选，用于 `psql`/`pg` 直接执行 SQL）

## 2. 导出原始数据（已完成可跳过）

原始秒哒后端 URL 与 anon key 在本地 `.env` 中。

```bash
node scripts/export_boardgame.mjs <原始supabase-url> <原始anon-key> miaoda-boardgame-export.json
```

导出文件为 `miaoda-boardgame-export.json`，已加入 `.gitignore`。

## 3. 导入数据到独立 Supabase

```bash
node scripts/import_boardgame.mjs https://<project>.supabase.co <service_role_key> miaoda-boardgame-export.json
```

脚本按外键顺序 upsert，重复执行安全。

## 4. 配置部署平台

- Vercel：根目录已有 `vercel.json`（SPA fallback）；在项目环境变量里设置
  `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`。
- Cloudflare Pages：根目录已有 `public/_redirects`（`/* /index.html 200`）；
  构建命令 `npm run build`，输出目录 `dist`，同样设置两个环境变量。

## 5. 部署后检查

- [ ] 首页能加载，项目/地图数据来自独立 Supabase
- [ ] 刷新 `/map-editor`、`/game-runner` 等非根路径不 404
- [ ] 新建/编辑项目、地图、规则、游戏会话均正常
- [ ] 不依赖秒哒原始后端
