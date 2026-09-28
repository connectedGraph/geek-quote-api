@echo off
chcp 65001 >nul
title Geek Quote API (Rust + SQLite)
echo ========================================================
echo   Geek Quote API 便携绿色版已启动
echo   - 数据库: 内置 SQLite (geek_quotes.db, 560条全量双语)
echo   - Web 面板: http://127.0.0.1:3000
echo   - 随机 API: http://127.0.0.1:3000/api/random
echo   正在自动打开浏览器...
echo ========================================================
echo.

start "" "http://127.0.0.1:3000"
"%~dp0geek-quote-api.exe"
pause
