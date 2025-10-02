## Bypass Hooks (Emergency Only)

```bash
# Skip all pre-commit hooks
git commit --no-verify -m "emergency: hotfix for critical bug"

# Skip pre-push hooks  
git push --no-verify

# Skip specific hook (not recommended)
HUSKY=0 git commit -m "bypass all husky hooks"
```

## 📋 Available Commands

```bash
# Manual lint-staged execution
pnpm run hooks:pre-commit    # Run the same checks as pre-commit hook
pnpm exec lint-staged        # Direct lint-staged execution

# Manual checks
pnpm run check:staged        # Check only staged files
pnpm run check               # Check all files  
pnpm run check:write         # Check and fix all files

# Setup commands
pnpm run hooks:install       # Install husky hooks
pnpm run prepare             # Automatic setup (runs on install)
```
