#!/bin/bash
echo "🛑 Stopping any running Next.js processes..."
pkill -f "next dev" || true
sleep 2

echo "🧹 Clearing caches..."
rm -rf .next
rm -rf node_modules/.prisma
rm -rf node_modules/.cache

echo "🔄 Regenerating Prisma Client..."
npx prisma generate

echo "✅ Ready! Now run: npm run dev"
