#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Morphina Store — one-shot Git init + first push to a NEW GitHub repo.
#
# USAGE
#   1. Create an EMPTY repository on GitHub (no README/license — keep it blank).
#   2. Run this script, and when it prompts, paste your git@github.com URL
#      or the HTTPS URL:   https://github.com/<username>/morphina-store.git
#
#   chmod +x git-init.sh   &&   ./git-init.sh
# ---------------------------------------------------------------------------
set -euo pipefail

# --- 1. Initialise a local repo with `main` as the default branch ---
if [ ! -d .git ]; then
  git init -b main
  echo "✔ Initialised git with branch 'main'"
else
  echo "ℹ .git already exists — skipping init"
fi

# --- 2. Stage every project file (respects .gitignore for secrets/deps) ---
git add .
echo "✔ Staged files (secrets & node_modules are excluded via .gitignore)"

# --- 3. First commit ---
git commit -m "chore: initial commit — Morphina Store storefront

- Entry point (index.html), design system (styles.css), app logic (app.js)
- 3D background (Three.js) + dark/light theme engine
- Cart, multi-step checkout, PayPal & Stripe, Kinguin auto-delivery prep
- Local static server (npm start), deployment + env docs (README, .env.example)"
echo "✔ Created 'main' commit"

# --- 4. Point at the remote (prompt for the GitHub URL) ---
read -r -p "Paste your GitHub repo URL (git@..  or  https://..): " REMOTE_URL
if [ -n "$REMOTE_URL" ]; then
  git remote add origin "$REMOTE_URL" 2>/dev/null || git remote set-url origin "$REMOTE_URL"
  echo "✔ Remote 'origin' set to: $REMOTE_URL"
else
  echo "⚠ No URL provided — run:  git remote add origin <your-repo-url>  git push -u origin main"
  exit 0
fi

# --- 5. Push the main branch upstream ---
git push -u origin main
echo ""
echo "✔ Done! Repo is live on GitHub. Enable GitHub Pages / connect to Netlify or Vercel."
