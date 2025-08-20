#!/bin/bash
# Git wrapper that uses Node.js 22.16.0 specifically
export PATH=~/node-22.16.0/bin:$PATH
echo "🚀 Using Node.js version: $(node --version) for git operations"
exec git "$@"