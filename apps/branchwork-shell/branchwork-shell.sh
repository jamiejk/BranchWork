#!/bin/bash
# BranchWork desktop launcher: runs the Electron shell.
# Server lifecycle (start-if-needed) is handled inside the shell itself.
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec npx --prefix "$DIR" electron "$DIR/main.js"
