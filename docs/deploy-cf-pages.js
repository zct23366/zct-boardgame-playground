#!/usr/bin/env node
// Cloudflare Pages direct deployment script
// Usage: node deploy-cf-pages.js <cloudflare-api-token> <account-id> <project-name> <dist-dir>

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const API_TOKEN = process.argv[2];
const ACCOUNT_ID = process.argv[3];
const PROJECT_NAME = process.argv[4] || "miaoda-board-game";
const DIST_DIR = process.argv[5] || path.join(__dirname, "..", "dist");

if (!API_TOKEN || !ACCOUNT_ID) {
  console.log("Usage: node deploy-cf-pages.js <api-token> <account-id> [project-name] [dist-dir]");
  console.log("\nGet your credentials at:");
  console.log("  API Token:  https://dash.cloudflare.com/profile/api-tokens (create with 'Cloudflare Pages' permission)");
  console.log("  Account ID: https://dash.cloudflare.com → select account → overview page");
  process.exit(1);
}

// Step 1: Create project if not exists
console.log(`[1] Checking project: ${PROJECT_NAME}`);
try {
  execSync(
    `curl -s -H "Authorization: Bearer ${API_TOKEN}" "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}"`,
    { stdio: "inherit" }
  );
} catch {}

// Step 2: Upload files
console.log(`\n[2] Deploying from: ${DIST_DIR}`);
execSync(
  `npx wrangler pages deploy "${DIST_DIR}" --project-name="${PROJECT_NAME}"`,
  { stdio: "inherit", env: { ...process.env, CLOUDFLARE_API_TOKEN: API_TOKEN, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID } }
);

console.log(`\nDone! https://${PROJECT_NAME}.pages.dev`);
