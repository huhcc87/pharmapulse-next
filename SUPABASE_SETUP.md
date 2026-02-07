# Supabase Setup Guide - Quick Start

## Error Fixed ✅

The app will no longer crash if Supabase is not configured. However, you need to set up Supabase to use authentication.

## Quick Setup (5 minutes)

### Step 1: Create Supabase Project

1. Go to https://app.supabase.com
2. Sign up / Sign in
3. Click "New Project"
4. Fill in:
   - **Name**: pharmapulse (or your choice)
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to you
5. Click "Create new project"
6. Wait ~2 minutes for project to be ready

### Step 2: Get Your Credentials

1. In your Supabase project, go to **Settings** (gear icon) → **API**
2. Copy these values:
   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **anon public** key: `eyJhbGc...` (long string)

### Step 3: Create .env.local File

In your project root (`pharmapulse-next/`), create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Replace** `your-project-id` and the anon key with your actual values from Step 2.

### Step 4: Configure Redirect URLs

1. In Supabase Dashboard, go to **Authentication** → **URL Configuration**
2. Under **Redirect URLs**, add:
   - `http://localhost:3000/auth/callback`
   - (For production later: `https://yourdomain.com/auth/callback`)
3. Click **Save**

### Step 5: Restart Dev Server

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

## Test It

1. Go to http://localhost:3000/register
2. Try to sign up - it should work!
3. Check your email (Supabase sends confirmation emails)

## Optional: Disable Email Confirmation (For Testing)

If you want to sign in immediately without email confirmation:

1. Go to **Authentication** → **Settings**
2. Find **"Enable email confirmations"**
3. **Disable** it (toggle off)
4. Save

Now users can sign in immediately after signup.

## Troubleshooting

### "Missing Supabase environment variables"
- ✅ **Fixed**: App won't crash, but you still need to create `.env.local` with credentials

### "Invalid redirect URL"
- Check that you added `http://localhost:3000/auth/callback` in Supabase Dashboard
- Make sure there are no trailing slashes

### "Email not sending"
- Check Supabase Dashboard → Authentication → Email Templates
- For development, emails should work automatically
- Check spam folder

### Still getting errors?
1. Make sure `.env.local` is in the project root (same folder as `package.json`)
2. Restart the dev server after creating `.env.local`
3. Check browser console for specific error messages

## Next Steps

Once Supabase is configured:
- ✅ Sign up / Sign in will work
- ✅ Password reset will work
- ✅ Email verification will work
- ✅ All auth flows are ready!

Need help? Check `SUPABASE_AUTH_IMPLEMENTATION.md` for detailed documentation.