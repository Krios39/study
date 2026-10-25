@echo off
if "%OV%"=="" set "OV=C:\Users\User\openvino_dl\x\openvino_toolkit_windows_2026.4.1.22982.07f9c262b05_x86_64"
call "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvars64.bat" >nul
cl /nologo /O2 /EHsc /std:c++17 /MD /I"%OV%\runtime\include" task8_bonus.cpp /link /LIBPATH:"%OV%\runtime\lib\intel64\Release" openvino.lib
