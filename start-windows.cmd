@echo off
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 goto python
py -3 server.py --open
goto done
:python
python server.py --open
:done
pause
