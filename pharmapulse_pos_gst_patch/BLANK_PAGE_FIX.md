# Blank page fix (Next.js)

If you see a blank page at /pos:
1) Confirm the route exists: `src/app/pos/page.tsx`
2) Confirm Tailwind CSS is loaded in `src/app/globals.css`
3) Check browser console for module resolution errors
4) Restart dev server: `npm run dev`

If `/api/pos/product` fails:
- verify prisma connection
- run migrations
- `npx prisma studio` to confirm Product rows exist
