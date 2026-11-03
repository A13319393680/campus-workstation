@echo off
chcp 65001 >nul
title 校园工作站
cd /d "%~dp0"
set "PORT=8765"
set "URL=http://127.0.0.1:%PORT%/"

echo.
echo   校园工作站 · 正在启动本地服务…
echo   地址：%URL%
echo.

where python >nul 2>nul
if not errorlevel 1 goto use_python

where py >nul 2>nul
if not errorlevel 1 goto use_py

set "NODE_EXE=%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\runtime\primary-runtime\dependencies\node\bin\node.exe"
if exist "%NODE_EXE%" goto use_node

echo   [×] 没找到 python 或 node，无法启动。
echo       请先安装 Python，或直接用浏览器打开 index.html（数据可能存不下来）。
echo.
pause
exit /b 1

:use_python
start "校园工作站 服务" /min cmd /c "cd /d "%~dp0" && python -m http.server %PORT% --bind 127.0.0.1"
goto opened

:use_py
start "校园工作站 服务" /min cmd /c "cd /d "%~dp0" && py -3 -m http.server %PORT% --bind 127.0.0.1"
goto opened

:use_node
start "校园工作站 服务" /min cmd /c "cd /d "%~dp0" && "%NODE_EXE%" server.js"
goto opened

:opened
timeout /t 2 >nul
start "" "%URL%"
echo   已经帮你打开浏览器。
echo   服务在一个最小化的窗口里运行，关掉那个窗口 = 停止服务。
echo   数据会保存在你选择的文件里；没选文件时只存在浏览器中。
echo.
timeout /t 6 >nul
exit /b 0