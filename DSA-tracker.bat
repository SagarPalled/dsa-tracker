@echo off
cd /d "d:\Learning\Fun projects\DSA-tracker"
echo Starting DSA Tracker Server...
start http://localhost:5500
python server.py
pause
