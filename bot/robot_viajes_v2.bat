@echo off
setlocal
where python >nul 2>nul && (set PY=python) || (set PY=py)
%PY% -B "%~dp0robot_viajes_v2.py" %*
echo.
echo ================================================================
echo  Robot VIAJES v2 (cabecera + albaranes + GASTOS autonomo + grabar). GRABA.
echo  Dejar abierto 'Entrada de Viajes' nuevo (desde el menu).
echo.
echo  USO (Opcion 2: lee la orden del clon y escribe el resultado ahi mismo):
echo    robot_viajes_v2.bat "CARPETA_DE_LA_ORDEN"
echo  Ej (clon de GitHub Desktop):
echo    robot_viajes_v2.bat "\\servidor\perfiles$\Operaciones\Documents\GitHub\Transliquidos_Estevez\ordenes-carga\ordenes\2026-10\jose-carlos-alfonsin\2026-10-02"
echo    (o arrastra esa carpeta de la orden sobre este .bat)
echo.
echo  El bot escribe resultado.json + nro_viaje_v1.png en esa carpeta.
echo  POR AHORA no pushea: subir con GitHub Desktop (Commit + Push).
echo  Sin argumento: modo local de prueba (orden_actual.json, no versiona).
echo  Log: robot_log.txt (al lado del robot).
echo ================================================================
pause
