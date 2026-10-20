@echo off
rem Lanzador de la inspeccion de SOLO LECTURA de Gesruta.
rem Corre el script PowerShell que esta al lado y guarda el resultado en gesruta_tree.txt
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0gesruta_inspect.ps1" 1>"%~dp0gesruta_run_log.txt" 2>&1
echo Listo. Resultados: gesruta_identidad.txt y gesruta_tree.txt (log en gesruta_run_log.txt).
timeout /t 3 >nul
