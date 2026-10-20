@echo off
rem Test enfocado de la ventana GASTOS (choferes autonomos).
rem Deja ABIERTA "Entrada de Albaranes" de un viaje de PRUEBA antes de correr.
cd /d "%~dp0"
python gastos_test.py
echo.
echo Listo. Revisa gastos_log.txt (al lado) y la pantalla.
pause
