# Production Deployment Guide - PharmaPulse

## 📋 **TABLE OF CONTENTS**

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Setup](#environment-setup)
3. [Database Migration](#database-migration)
4. [Deployment Options](#deployment-options)
5. [Vercel Deployment (Recommended)](#vercel-deployment-recommended)
6. [Docker Deployment](#docker-deployment)
7. [Post-Deployment](#post-deployment)
8. [Monitoring & Logging](#monitoring--logging)
9. [Troubleshooting](#troubleshooting)

---

## ✅ **PRE-DEPLOYMENT CHECKLIST**

### **Code Quality:**
- [ ] All TypeScript errors resolved
- [ ] ESLint passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] No console errors in browser
- [ ] All API endpoints tested

### **Security:**
- [ ] Environment variables secured
- [ ] API keys rotated
- [ ] Database credentials encrypted
- [ ] HTTPS enabled
- [ ] CORS configured
- [ ] Rate limiting enabled

### **Database:**
- [ ] Schema migrated (`npx prisma db push`)
- [ ] Seed data loaded (if needed)
- [ ] Database backups configured
- [ ] Connection pooling enabled

### **Configuration:**
- [ ] Production environment variables set
- [ ] Payment gateway keys configured
- [ ] WhatsApp API credentials set
- [ ] E-Invoice credentials configured
- [ ] Government API keys configured

---

## 🔧 **ENVIRONMENT SETUP**

### **1. Create Production Environment File**

Create `.env.production` in the project root:

```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/pharmapulse_prod?schema=public"
DIRECT_URL="postgresql://user:password@host:5432/pharmapulse_prod?schema=public"

# NextAuth
NEXTAUTH_URL="https://yourdomain.com"
NEXTAUTH_SECRET="your-nextauth-secret-here-generate-with-openssl-rand-base64-32"

# OpenAI (AI Features)
OPENAI_API_KEY="sk-..."

# AWS Bedrock (Alternative AI)
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="us-east-1"

# Razorpay (Payments)
RAZORPAY_KEY_ID="rzp_live_..."
RAZORPAY_KEY_SECRET="..."

# Stripe (Payments)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# WhatsApp Business API
WHATSAPP_API_URL="https://graph.facebook.com/v18.0"
WHATSAPP_PHONE_NUMBER_ID="..."
WHATSAPP_ACCESS_TOKEN="..."
WHATSAPP_VERIFY_TOKEN="your-verify-token"

# E-Invoice (NIC API)
E_INVOICE_API_URL="https://einvoice1.gst.gov.in"
E_INVOICE_USERNAME="..."
E_INVOICE_PASSWORD="..."
E_INVOICE_CLIENT_ID="..."
E_INVOICE_CLIENT_SECRET="..."

# E-Way Bill
E_WAYBILL_API_URL="https://ewaybillgst.gov.in"
E_WAYBILL_USERNAME="..."
E_WAYBILL_PASSWORD="..."

# Government APIs
CDSCO_API_KEY="..."
NPPA_API_KEY="..."
MCI_API_KEY="..."
UIDAI_API_KEY="..."

# VAPID Keys (Push Notifications)
NEXT_PUBLIC_VAPID_PUBLIC_KEY="..."
VAPID_PRIVATE_KEY="..."

# Supabase (Storage & Database)
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."

# Application
NODE_ENV="production"
NEXT_PUBLIC_APP_URL="https://yourdomain.com"
```

### **2. Generate Secrets**

```bash
# Generate NextAuth secret
openssl rand -base64 32

# Generate VAPID keys (for push notifications)
npm install -g web-push
web-push generate-vapid-keys
```

---

## 🗄️ **DATABASE MIGRATION**

### **1. Create Production Database**

Using Supabase or your PostgreSQL provider:

```bash
# Option 1: Supabase Dashboard
# Create new project at https://supabase.com

# Option 2: Direct PostgreSQL
createdb pharmapulse_prod
```

### **2. Run Schema Migration**

```bash
# Update DATABASE_URL in .env.production first
export DATABASE_URL="postgresql://user:password@host:5432/pharmapulse_prod"

# Generate Prisma Client
npx prisma generate

# Push schema to production database
npx prisma db push --accept-data-loss

# Or use migrations (recommended for production)
npx prisma migrate deploy
```

### **3. Seed Production Data (Optional)**

```bash
# Seed HSN codes
npm run seed:hsn

# Seed drug library (if needed)
npm run seed:drug-library
```

### **4. Verify Database**

```bash
# Open Prisma Studio
npx prisma studio

# Or use psql
psql $DATABASE_URL
\dt  # List tables
```

---

## 🚀 **DEPLOYMENT OPTIONS**

### **Option 1: Vercel (Recommended for Next.js)**
- **Pros:** Zero-config, automatic HTTPS, CDN, serverless functions
- **Cons:** Vendor lock-in, serverless cold starts
- **Best for:** Most Next.js applications

### **Option 2: Docker + Cloud Provider**
- **Pros:** Portable, full control, any cloud provider
- **Cons:** More setup, need to manage infrastructure
- **Best for:** Enterprise deployments, specific requirements

### **Option 3: Traditional VPS**
- **Pros:** Full control, cost-effective
- **Cons:** Manual setup, need to manage everything
- **Best for:** Small deployments, learning

---

## ⚡ **VERCEL DEPLOYMENT (RECOMMENDED)**

### **Step 1: Install Vercel CLI**

```bash
npm i -g vercel
```

### **Step 2: Login to Vercel**

```bash
vercel login
```

### **Step 3: Link Project**

```bash
cd pharmapulse-next
vercel link
```

### **Step 4: Set Environment Variables**

#### **Option A: Via Vercel Dashboard**
1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add all variables from `.env.production`

#### **Option B: Via CLI**

```bash
# Add environment variables
vercel env add DATABASE_URL production
vercel env add NEXTAUTH_SECRET production
vercel env add OPENAI_API_KEY production
# ... repeat for all variables
```

#### **Option C: Via File (Bulk Import)**

Create `vercel-env.json`:
```json
{
  "DATABASE_URL": "postgresql://...",
  "NEXTAUTH_SECRET": "...",
  "OPENAI_API_KEY": "..."
}
```

Then:
```bash
vercel env pull .env.local
# Review and deploy
```

### **Step 5: Deploy**

```bash
# Deploy to production
vercel --prod

# Or deploy to preview
vercel
```

### **Step 6: Configure Custom Domain**

1. Go to Vercel Dashboard → Settings → Domains
2. Add your domain
3. Update DNS records as shown
4. Update `NEXTAUTH_URL` to match your domain

### **Step 7: Enable HTTPS**

Vercel automatically provides HTTPS certificates via Let's Encrypt.

---

## 🐳 **DOCKER DEPLOYMENT**

### **1. Create Dockerfile**

Create `Dockerfile` in project root:

```dockerfile
# Use Node.js 20 LTS
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### **2. Update next.config.js for Docker**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone', // Important for Docker
  // ... rest of config
}

module.exports = nextConfig
```

### **3. Create docker-compose.yml**

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - NEXTAUTH_URL=${NEXTAUTH_URL}
      # Add all other env vars
    env_file:
      - .env.production
    restart: unless-stopped
    depends_on:
      - db

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=pharmapulse_prod
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

### **4. Build and Deploy**

```bash
# Build Docker image
docker build -t pharmapulse:latest .

# Run with docker-compose
docker-compose up -d

# Or run directly
docker run -p 3000:3000 --env-file .env.production pharmapulse:latest
```

### **5. Deploy to Cloud Provider**

#### **AWS (ECS/EKS):**
```bash
# Build and push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
docker tag pharmapulse:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/pharmapulse:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/pharmapulse:latest

# Deploy to ECS/EKS
# Use AWS Console or CLI
```

#### **Google Cloud (Cloud Run):**
```bash
# Build and push to GCR
gcloud builds submit --tag gcr.io/PROJECT-ID/pharmapulse

# Deploy to Cloud Run
gcloud run deploy pharmapulse \
  --image gcr.io/PROJECT-ID/pharmapulse \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

#### **Azure (Container Instances):**
```bash
# Build and push to ACR
az acr build --registry <registry-name> --image pharmapulse:latest .

# Deploy to Container Instances
az container create \
  --resource-group <resource-group> \
  --name pharmapulse \
  --image <registry-name>.azurecr.io/pharmapulse:latest \
  --dns-name-label <dns-label> \
  --ports 3000
```

---

## 🔄 **POST-DEPLOYMENT**

### **1. Verify Deployment**

```bash
# Check health endpoint
curl https://yourdomain.com/api/health

# Test API endpoints
curl https://yourdomain.com/api/dashboard/summary
```

### **2. Database Migration (After Deployment)**

```bash
# Run migrations on production
DATABASE_URL="postgresql://..." npx prisma migrate deploy

# Or via Vercel CLI
vercel env pull .env.local
npx prisma migrate deploy
```

### **3. Set Up Domain**

1. Configure DNS A/CNAME records
2. Update `NEXTAUTH_URL` to production domain
3. Verify SSL certificate

### **4. Configure Webhooks**

#### **Stripe Webhook:**
```
URL: https://yourdomain.com/api/billing/webhook
Events: invoice.paid, customer.subscription.updated, etc.
```

#### **Razorpay Webhook:**
```
URL: https://yourdomain.com/api/razorpay/webhook
Events: payment.captured, order.paid, etc.
```

#### **WhatsApp Webhook:**
```
URL: https://yourdomain.com/api/whatsapp/webhook
Verify Token: (from .env)
```

### **5. Enable Analytics**

```bash
# Add Vercel Analytics (if using Vercel)
npm install @vercel/analytics

# Add to layout.tsx
import { Analytics } from '@vercel/analytics/react'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

---

## 📊 **MONITORING & LOGGING**

### **1. Set Up Error Tracking**

#### **Sentry (Recommended):**

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Update `sentry.client.config.ts`:
```typescript
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
})
```

### **2. Set Up Logging**

#### **Vercel Logs (If using Vercel):**
- Automatically available in Vercel Dashboard
- View logs: `vercel logs`

#### **Custom Logging (Winston):**

```bash
npm install winston
```

Create `src/lib/logger.ts`:
```typescript
import winston from 'winston'

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
})

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }))
}
```

### **3. Set Up Uptime Monitoring**

- **UptimeRobot:** https://uptimerobot.com (Free tier available)
- **Pingdom:** https://pingdom.com
- **StatusCake:** https://www.statuscake.com

Monitor:
- `https://yourdomain.com/api/health`
- `https://yourdomain.com` (Home page)

### **4. Set Up Performance Monitoring**

#### **Vercel Analytics:**
- Automatically enabled on Vercel
- View in Vercel Dashboard → Analytics

#### **Google Analytics:**
```bash
npm install @vercel/analytics
# Add to layout.tsx as shown above
```

---

## 🐛 **TROUBLESHOOTING**

### **Common Issues:**

#### **1. Database Connection Error**
```bash
# Check connection string
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check Prisma connection
npx prisma db pull
```

#### **2. Build Failures**
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Check TypeScript errors
npx tsc --noEmit
```

#### **3. Environment Variables Not Loading**
```bash
# Verify in Vercel Dashboard
# Check variable names match exactly (case-sensitive)
# Restart deployment after adding variables
```

#### **4. API Routes Not Working**
```bash
# Check file structure: src/app/api/[route]/route.ts
# Verify HTTP method (GET, POST, etc.)
# Check Vercel function logs
```

#### **5. Prisma Client Errors**
```bash
# Regenerate Prisma Client
npx prisma generate

# Push schema
npx prisma db push
```

### **Debug Commands:**

```bash
# Check build output
npm run build

# Check for TypeScript errors
npx tsc --noEmit

# Check for linting errors
npm run lint

# View Vercel logs
vercel logs [deployment-url]

# Local production build
npm run build && npm start
```

---

## ✅ **DEPLOYMENT CHECKLIST**

- [ ] All environment variables configured
- [ ] Database migrated and seeded
- [ ] Build succeeds locally
- [ ] All API endpoints tested
- [ ] Custom domain configured
- [ ] SSL certificate active
- [ ] Webhooks configured
- [ ] Monitoring set up
- [ ] Error tracking enabled
- [ ] Backups configured
- [ ] Documentation updated

---

## 📚 **ADDITIONAL RESOURCES**

- **Vercel Docs:** https://vercel.com/docs
- **Next.js Deployment:** https://nextjs.org/docs/deployment
- **Prisma Deployment:** https://www.prisma.io/docs/guides/deployment
- **Docker Docs:** https://docs.docker.com

---

**Last Updated:** January 2026  
**Status:** ✅ Production-Ready
