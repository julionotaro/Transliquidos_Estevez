@echo off
setlocal
where python >nul 2>nul && (set PY=python) || (set PY=py)
%PY% -B "%~dp0robot_viajes_v2.py"
echo.
echo ====== Robot VIAJES v2 (cabecera + albaranes + km PROPIO / GASTOS autonomo + grabar). GRABA. ======
echo Dejar abierto 'Entrada de Viajes' nuevo (desde el menu). Lee orden_actual.json
echo Autonomo: cabecera.tipo=="autonomo" -> km van en Gastos (km.carga / km.vacio del orden.json).
echo Log: robot_log.txt
pause
