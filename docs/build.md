# Build Guide

Feel free to ask any questions regarding building using issues.

## Prerequisites

- **Git**: Version control system
- **Node.js**: `v21` (recommended)
- **pnpm**: Package manager - Install with `npm install -g pnpm` or `corepack enable`

### Platform-Specific Requirements

- **Windows**: Windows 10+ (Windows 11 recommended)
- **macOS**: macOS 10.15+ (Catalina or later)
- **Linux**: Ubuntu 20.04+, Debian 11+, or equivalent

## Quick Start

```bash
git clone https://github.com/mienaiyami/yomikiru/

cd yomikiru

# install dependencies
pnpm install

# run dev build
pnpm dev

# build for current OS (output in ./out)
pnpm package
# or 
pnpm make:zip64
# or check `make:` commands in package.json scripts for more options
```

Output is in `./out` folder.

Check [package.json](https://github.com/mienaiyami/yomikiru/blob/9b159ce15938d2f43b99047decb38ff2ba7bb893/package.json#L24), [forge.config.ts -> makers](https://github.com/mienaiyami/yomikiru/blob/9b159ce15938d2f43b99047decb38ff2ba7bb893/forge.config.ts#L59) and <https://www.electronforge.io/config/makers> for more options.

## Database (Drizzle ORM)

Yomikiru uses Drizzle ORM with SQLite as the database backend to store user data like library items, reading progress, bookmarks, and notes.

### Database Setup

The database is configured in `drizzle.config.ts`:

- **Database**: SQLite (`data.db`)
- **Schema**: `src/electron/db/schema.ts`
- **Migrations**: `drizzle/` directory

### Database Commands

```bash
# Generate migrations after schema changes
pnpm drizzle:generate

# Push schema changes to database (for development)
pnpm drizzle:push

# Apply migrations to database
pnpm drizzle:migrate

# Open Drizzle Studio (database viewer/editor)
pnpm drizzle:studio
```

### IPC Communication

Database operations are exposed to the renderer process through IPC handlers in `src/electron/ipc/database.ts`. The main process handles all database operations and sends change notifications to renderer windows.

### Database Location

- **Development**: `data.db` in project root
- **Production**: `data.db` in app's userData directory
- **Portable**: `userdata/data.db` relative to app executable

### Development Workflow

1. **Schema Changes**: Edit `src/electron/db/schema.ts`
2. **Generate Migration**: Run `pnpm drizzle:generate`
3. **Apply Changes**: Run `pnpm drizzle:migrate` or `pnpm drizzle:push`
4. **View Database**: Use `pnpm drizzle:studio` or any other database viewer to inspect data

### Hot Reload Development

```bash
# Start development server
pnpm dev

# The app will automatically reload when you make changes to:
# - React components (renderer process)
# - Main process code (with restart)
# - Styles and assets
```

### Code Quality

```bash
# Run all checks
pnpm lint

# Fix auto-fixable issues
pnpm eslint --fix

# Check TypeScript types
pnpm tslint
```

### Debugging

- **Main Process**: Use VS Code debugger or `console.log` statements
- **Renderer Process**: Use Chrome DevTools (Ctrl+Shift+I in development)
- **Database**: Use `pnpm drizzle:studio` or any other database viewer to inspect database state
- **Logs**: Check `logs/main.log` in userData directory

## Platform-Specific Building

### Windows

```bash
# 64-bit (recommended)
pnpm make:win64

# 32-bit (legacy systems)
pnpm make:win32

# Installer only
pnpm make:exe64
```

### Linux

```bash
# Debian/Ubuntu package
pnpm make:deb

# Generic ZIP
pnpm make:zip64
```

### macOS

```bash
# ZIP package
pnpm make:zip64

# Note: macOS specific builds may require additional setup
```

## Troubleshooting

### Common Issues

1. **Native Module Compilation Errors**

   ```bash
   # Clear node_modules and reinstall
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   
   # Rebuild native modules
   pnpm rebuild:electron
   ```

2. **SQLite/Database Issues**

   ```bash
   # Delete database and restart
   rm data.db
   pnpm dev
   ```

3. **Build Failures**

   ```bash
   # Clean build artifacts
   rm -rf .webpack out
   pnpm package
   ```

4. **Permission Issues (Linux)**

   ```bash
   # Make sure you have build tools
   sudo apt-get install build-essential
   ```

### Code Style

- Follow the existing TypeScript and React patterns
- Use the provided ESLint configuration
- Write meaningful commit messages
- Test your changes on different platforms when possible

---

> [!NOTE]
> Native modules need to compiled for electron's node version. If you have issues with native modules, try running `pnpm rebuild:node` or `pnpm rebuild:electron` to rebuild native modules for electron.
> Try removing `node_modules` and running `pnpm install` again if you still have issues.
> Contact me if you have issues.
