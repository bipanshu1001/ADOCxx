@echo off
rem Double-click to build (if needed) and run the ADOC simulation
cd /d "%~dp0"
set "PATH=C:\MinGW\bin;%PATH%"
g++ -std=c++14 -O2 -Wall -Wextra adoc_tuner.cpp metrics_collector.cpp stall_listener.cpp workload.cpp main.cpp -o adoc.exe
if errorlevel 1 (
    echo.
    echo BUILD FAILED
    pause
    exit /b 1
)
echo.
adoc.exe
echo.
pause
