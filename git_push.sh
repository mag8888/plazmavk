#!/bin/bash
echo "=== Git Status ==="
git status
echo ""
echo "=== Git Remote ==="
git remote -v
echo ""
echo "=== Git Log ==="
git log --oneline -3
echo ""
echo "=== Adding files ==="
git add -A
echo ""
echo "=== Committing ==="
git commit -m "Fix credit system and standardize bank UI"
echo ""
echo "=== Pushing ==="
git push origin main
echo ""
echo "=== Final Status ==="
git status

