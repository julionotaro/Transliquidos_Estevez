@echo off
setlocal
where python >nul 2>nul && (set PY=python) || (set PY=py)
%PY% -I -B "%~dp0test_nro_viaje.py"
echo.
echo ================================================================
echo  TEST Nro VIAJE (solo lectura).
echo  Correr DOS veces:
echo    1) con "Entrada de Viajes" delante (viaje GRABADO, Nro visible)
echo    2) con "Entrada de Albaranes" de ese viaje delante
echo  Resultado (se acumula): test_nro_viaje_log.txt (en esta carpeta)
echo ================================================================
pause
