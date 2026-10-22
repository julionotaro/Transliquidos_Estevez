@echo off
setlocal
where python >nul 2>nul && (set PY=python) || (set PY=py)
%PY% -I -B "%~dp0test_captura_nro.py"
echo.
echo ================================================================
echo  TEST CAPTURA Nro VIAJE (solo lectura, por GDI, sin Pillow).
echo  Dejar "Entrada de Viajes" delante con el viaje GRABADO
echo  (que se vea el Nro arriba a la izquierda).
echo  Genera: nro_viaje_crop.png, nro_viaje_crop_full.png y el log.
echo  Pasarle a Claude los dos PNG.
echo ================================================================
pause
