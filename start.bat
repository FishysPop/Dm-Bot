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
if %errorlevel% neq 0 (
    echo Failed to install npm dependencies.
    pause
    exit /b 1
)

echo Installation complete. 

echo Starting the bot...
call npm start
if %errorlevel% neq 0 (
    echo Failed to start the bot.
    pause
    exit /b 1
)

echo Bot has stopped. Press any key to exit...
pause