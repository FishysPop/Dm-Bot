@echo off
echo Checking if Node.js is installed...
call node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js is not installed. Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js is installed.
echo Installing npm dependencies...
call npm install

echo Installation complete. 

echo Starting the bot...
call npm start

echo Bot has stopped. Press any key to exit...
pause