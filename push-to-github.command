#!/bin/bash
# ============================================================
# ParkNest — guided "push to GitHub" (double-clickable on Mac)
# ============================================================
cd "$(dirname "$0")" || exit 1

clear
echo "  ParkNest -> GitHub"
echo "  =================="
echo ""

# git installed?
if ! command -v git >/dev/null 2>&1; then
  echo "  git isn't installed yet. macOS installs it automatically the first"
  echo "  time you use it — a popup will appear; click Install."
  echo "  Then run this file again."
  git --version 2>/dev/null
  read -r -p "  Press Enter to close..."
  exit 1
fi

# first-time git identity
if ! git config user.email >/dev/null 2>&1; then
  echo "  First time using git here — quick one-time setup."
  read -r -p "  Your GitHub email: " GEMAIL
  read -r -p "  Your name: " GNAME
  git config --global user.email "$GEMAIL"
  git config --global user.name "$GNAME"
  echo ""
fi

echo "  STEP 1 — Create an EMPTY repository on GitHub (if you haven't yet):"
echo "     open  github.com/new"
echo "     name it (e.g. parknest) -> do NOT tick 'Add a README' -> Create"
echo ""
read -r -p "  STEP 2 — Repository URL [press Enter for https://github.com/apurv13-de/parknest.git]: " REPO
[ -z "$REPO" ] && REPO="https://github.com/apurv13-de/parknest.git"
echo ""

# init / commit / push (safe to re-run)
git init 2>/dev/null
git add .
git commit -m "ParkNest — society parking rental platform" 2>/dev/null || echo "  (nothing new to commit)"
git branch -M main
git remote remove origin 2>/dev/null
git remote add origin "$REPO"

echo "  Pushing... if a login window appears, sign in to GitHub."
echo ""
if git push -u origin main; then
  echo ""
  echo "  DONE! Your code is at:  $REPO"
  echo ""
  echo "  NEXT STEPS (details in README.md -> Deploy):"
  echo "   1. Render.com -> New -> Blueprint -> pick this repo  (starts the API)"
  echo "   2. Put your Render URL into public/js/config.js, then re-run this file"
  echo "      to push the update."
  echo "   3. GitHub repo -> Settings -> Pages -> Source: GitHub Actions"
  echo "      (your site goes live at https://YOURNAME.github.io/parknest/)"
else
  echo ""
  echo "  Push failed — almost always a sign-in issue:"
  echo "   • If Terminal asks for a password, GitHub wants a Personal Access"
  echo "     Token instead:  github.com/settings/tokens -> Generate new token"
  echo "     (classic) -> tick 'repo' -> copy it -> paste as the password."
  echo "   • Or the easy way: install GitHub Desktop (desktop.github.com),"
  echo "     sign in once, and use File -> Add Local Repository on this folder."
fi
read -r -p "  Press Enter to close..."
