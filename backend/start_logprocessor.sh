#!/usr/bin/bash
cd ~/Codes/phira-mp-logprocessor
./line_by_line server.log | yarn start
