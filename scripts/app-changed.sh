#!/usr/bin/env bash
# Reads changed paths on stdin. Prints "true" if any of them can change the
# running app or the mabl gates themselves, else "false".
if grep -qE '^(src/|messages/|public/|package(-lock)?\.json$|next\.config\.|postcss\.config\.|tsconfig\.json$|\.nvmrc$|\.github/workflows/(ci|postdeploy)\.yml$|scripts/(mabl-impact|app-changed)\.sh$)'; then
  echo true
else
  echo false
fi
