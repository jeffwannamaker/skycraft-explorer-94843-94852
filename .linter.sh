#!/bin/bash
cd /home/kavia/workspace/code-generation/skycraft-explorer-94843-94852/react_js_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

