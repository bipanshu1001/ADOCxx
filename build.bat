@echo off
rem Double-click to compile the ADOC reproduction into adoc.exe
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
echo BUILD OK - created adoc.exe
pause
