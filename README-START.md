# How to Start the Development Server

## Quick Start

1. **Open Terminal** (in this project directory)

2. **Start the Development Server:**
   ```bash
   npm run dev
   ```

3. **Wait for the server to start** - You'll see output like:
   ```
   ▲ Next.js 14.2.35
   - Local:        http://localhost:3000
   - Ready in 2.5s
   ```

4. **Open your browser** and navigate to:
   - **Main App:** http://localhost:3000
   - **Settings Page:** http://localhost:3000/settings
   - **Dashboard:** http://localhost:3000/dashboard

## Alternative: Open Browser Automatically

You can also use these commands:

**On macOS:**
```bash
npm run dev && open http://localhost:3000
```

**Or manually:**
- Press `Cmd + Space` to open Spotlight
- Type "Chrome" or "Safari" or "Firefox"
- Press Enter
- Type `http://localhost:3000` in the address bar

## Troubleshooting

If you see "port 3000 already in use":
```bash
# Kill the process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 npm run dev
```

## Prerequisites

Make sure you have:
- Node.js installed (v18 or higher)
- Dependencies installed: `npm install`
- Database running (if using Prisma)
- Environment variables set (`.env` file)
