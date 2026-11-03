@echo off
chcp 65001 >nul
title 校园工作站（手机可访问）
cd /d "%~dp0"
set "PORT=8765"
set "HOST=0.0.0.0"

echo.
echo   校园工作站 · 手机/局域网可访问模式
echo   请确保手机和这台电脑连的是同一个路由器。
echo.

where python >nul 2>nul
if not errorlevel 1 goto use_python

where py >nul 2>nul
if not errorlevel 1 goto use_py

set "NODE_EXE=%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\runtime\primary-runtime\dependencies\node\bin\node.exe"
if exist "%NODE_EXE%" goto use_node

echo   [×] 没找到 python 或 node，无法启动。
echo.
pause
exit /b 1

:use_python
start "校园工作站 服务" /min cmd /c "cd /d "%~dp0" && python -m http.server %PORT% --bind 0.0.0.0"
goto opened

:use_py
start "校园工作站 服务" /min cmd /c "cd /d "%~dp0" && py -3 -m http.server %PORT% --bind 0.0.0.0"
goto opened

:use_node
start "校园工作站 服务" /min cmd /c "cd /d "%~dp0" && set HOST=0.0.0.0 && "%NODE_EXE%" server.js"
goto opened

:opened
timeout /t 2 >nul
echo.
echo   本机打开：http://127.0.0.1:%PORT%/
echo   手机打开：http://下面这个地址:%PORT%/
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do @echo   http://%%a:%PORT%/    
echo.
echo   打不开的话：Windows 防火墙弹窗要选「允许」；
echo   如果宿舍网络开了设备隔离，就只能用「手机访问.md」里的方案二或方案三。
echo.
start "" "http://127.0.0.1:%PORT%/"
timeout /t 12 >nul
exit /b 0