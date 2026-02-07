# PharmaPulse AI

India's first AI-powered pharmacy management platform designed for retail pharmacies, distributors, and wholesalers.

## Features

- **Retail Pharmacy Management**: POS, inventory management, and compliance
- **Distributor/Wholesaler**: Bulk catalog management, ordering, fulfillment, and receivables
- **Marketplace**: Multi-distributor network with analytics and insights
- **AI-Powered**: Prescription intelligence, drug identification, and analytics
- **PWA Support**: Works offline with local data synchronization
- **India-First**: Designed specifically for the Indian pharmaceutical market

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, tRPC
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with role-based access control
- **AI Integration**: OpenAI API for drug analysis and prescription intelligence
- **Offline Support**: Service Worker, IndexedDB for offline data storage
- **Deployment**: Vercel with Edge Functions

## Getting Started

### Prerequisites

- Node.js 18.x or later
- PostgreSQL database

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/pharmapulse-next.git
   cd pharmapulse-next
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` with your database and API credentials.

### Supabase Setup (Required)

The application uses Supabase for authentication and data storage. **See [`SUPABASE_SETUP_GUIDE.md`](./SUPABASE_SETUP_GUIDE.md) for complete setup instructions.**

**Quick setup:**

1. Create Supabase project at [app.supabase.com](https://app.supabase.com)
2. Get credentials from **Settings → API**:
   - Project URL
   - anon public key
   - service_role key (optional, for admin operations)
3. Add to `.env.local`:
   ```bash
   # Required (browser-safe)
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your-anon-key
   
   # Optional (server-only, never use NEXT_PUBLIC prefix!)
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your-service-role-key
   ```
4. Verify setup:
   ```bash
   npm run check:env
   # Or visit: http://localhost:3000/api/supabase/health
   ```

**⚠️ Security:** Never use `NEXT_PUBLIC` prefix for `SUPABASE_SERVICE_ROLE_KEY`. See [SUPABASE_SETUP_GUIDE.md](./SUPABASE_SETUP_GUIDE.md) for security best practices.

**Important:** For admin licence management, add these secure variables:
   ```bash
   ADMIN_MASTER_SECRET=your-super-secret-key-here
   ADMIN_MASTER_CODE=YOUR_SECRET_ADMIN_CODE_HERE
   ```
   See `ENV_SETUP_ADMIN.md` for detailed setup instructions.

4. Set up the database:
   ```bash
   # Sync database schema with Prisma schema and generate Prisma client
   npm run db:sync
   ```
   
   Or manually:
   ```bash
   npx prisma db push
   npx prisma generate
   ```

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database Management

### Syncing Database Schema

If you encounter errors like "Database schema error: field 'X' not found", sync your database:

```bash
# Quick sync (recommended)
npm run db:sync

# This runs:
# - prisma db push (syncs schema to database)
# - prisma generate (regenerates Prisma client)
```

**Important**: After running `npm run db:sync`, always restart your dev server:
```bash
# Stop server (Ctrl+C), then:
npm run dev
```

### Available Database Scripts

- `npm run db:sync` - Sync database schema and regenerate Prisma client
- `npm run db:push` - Push schema changes to database
- `npm run db:generate` - Regenerate Prisma client
- `npm run db:seed` - Seed database with sample data

## Deployment

The application is configured for deployment on Vercel. Connect your GitHub repository to Vercel for automatic deployments.

## Documentation

- [India POS + Billing + Hardware Guide](/docs/pos-billing-india) - Complete guide for POS operations, hardware integration, and invoice templates for the Indian market.

## License

This project is licensed under the ISC License.

## Contact

For questions or support, please contact [your-email@example.com](mailto:your-email@example.com).
