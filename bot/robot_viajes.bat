@echo off
setlocal
where python >nul 2>nul && (set PY=python) || (set PY=py)
%PY% -B "%~dp0robot_viajes.py"
echo.
echo ====== Robot VIAJES COMPLETO (cabecera + albaranes + grabar viaje). GRABA. ======
echo Dejar abierto 'Entrada de Viajes' nuevo (desde el menu). Lee orden_actual.json
echo Log: robot_log.txt
pause
