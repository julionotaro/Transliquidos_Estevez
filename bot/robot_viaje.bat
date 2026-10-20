@echo off
setlocal
where python >nul 2>nul && (set PY=python) || (set PY=py)
%PY% -B "%~dp0robot_viaje.py"
echo.
echo ====== Robot VIAJE MULTI-ALBARAN v1. ESTE GRABA. ======
echo Julio deja el viaje con matriculas cargadas y el 1er albaran en blanco.
echo El robot graba cada albaran, F3 al siguiente, F2 graba el viaje al final.
echo Lee: orden_actual.json   Log: robot_log.txt
pause
