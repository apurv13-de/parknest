#!/bin/bash
# ============================================================
# ParkNest — one-double-click launcher for macOS
# Handles first-time setup automatically.
# ============================================================
cd "$(dirname "$0")/server" || exit 1

if ! command -v node >/dev/null 2>&1; then
  clear
  echo "Node.js is not installed yet (needed to run ParkNest)."
  echo ""
  echo "  1. The Node.js website is opening now."
  echo "  2. Download the LTS installer (left button) and install it."
  echo "  3. Run this ParkNest file again."
  echo ""
  sleep 1
  open "https://nodejs.org"
  read -r -p "Press Enter to close this window..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "First run — installing dependencies (one time, ~30-60s)..."
  echo ""
  npm install || { echo "Install failed — check your internet connection and try again."; read -r -p "Press Enter to close..."; exit 1; }
fi

clear
echo "  Starting ParkNest..."
echo ""
echo "  Your browser will open at  http://localhost:4000"
echo "  Keep this window open while using the site."
echo "  To stop: press Ctrl+C here (or just close this window)."
echo ""
echo "  Demo login:  demo@parknest.in  /  demo1234"
echo "  Admin login: admin@parknest.in /  admin1234"
echo ""
( sleep 2.5 && open "http://localhost:4000" ) &
npm start
