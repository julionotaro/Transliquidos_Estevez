@echo off
setlocal
where python >nul 2>nul && (set PY=python) || (set PY=py)
%PY% -B "%~dp0robot_viajes_v2.py" %*
echo.
echo ================================================================
echo  Robot VIAJES v2 (cabecera + albaranes + GASTOS autonomo + grabar). GRABA.
echo  Dejar abierto 'Entrada de Viajes' nuevo (desde el menu).
echo.
echo  USO RECOMENDADO (Opcion 2: escribe el resultado en la carpeta de la
echo  orden del repo y lo pushea a git, asi nadie lleva archivos a mano):
echo     robot_viajes_v2.bat "RUTA\ordenes-carga\ordenes\AAAA-MM\chofer\AAAA-MM-DD"
echo     (o arrastra esa carpeta de la orden sobre este .bat)
echo.
echo  SIN argumento: modo local de prueba (lee orden_actual.json, NO pushea).
echo  Log: robot_log.txt (al lado del robot).
echo ================================================================
pause
