#!/usr/bin/env bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "========================================================"
echo "  Geek Quote API Portable Bundle"
echo "  - Database: Built-in SQLite (geek_quotes.db)"
echo "  - Web Dashboard: http://127.0.0.1:3000"
echo "  - Random Quote API: http://127.0.0.1:3000/api/random"
echo "========================================================"

if command -v xdg-open > /dev/null; then
  xdg-open "http://127.0.0.1:3000" &
elif command -v open > /dev/null; then
  open "http://127.0.0.1:3000" &
fi

./geek-quote-api
