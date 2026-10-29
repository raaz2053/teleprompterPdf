@echo off
title CuePDF
cd /d "%~dp0"
node start.js
if errorlevel 1 pause