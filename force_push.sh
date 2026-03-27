#!/bin/bash
# Force push script
cd /Users/ADMIN/EM1

# Set remote to HTTPS
git remote set-url origin https://github.com/mag8888/EM1.git

# Add all changes
git add -A

# Commit with message
git commit -m "Fix credit system and standardize bank UI

- Fixed credit system: 5000$ credit → +500$ expenses, PAYDAY decreases by 500$
- Credit details now show 'Платежи по кредиту: $500' in breakdown
- Multiple credits allowed up to maximum limit
- Moved expenses arrow inside bank UI
- Standardized bank interface for better screen fit
- Added child event system for inner circle with dice roll and celebration
- Fixed server-authoritative movement and position persistence"

# Push to main branch
git push -u origin main

echo "Push completed!"

