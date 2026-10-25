@echo off
if "%OV%"=="" set "OV=C:\Users\User\openvino_dl\x\openvino_toolkit_windows_2026.4.1.22982.07f9c262b05_x86_64"
call "%OV%\setupvars.bat" >nul
"%~dp0task8_bonus.exe" %*
