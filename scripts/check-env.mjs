#!/usr/bin/env node

/**
 * Environment Variables Check Utility
 * 
 * Checks if required Supabase environment variables are configured.
 * Exits with code 1 if any required vars are missing.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Try to load .env.local (Next.js reads this in dev)
let envVars = {};
try {
  const envLocalPath = join(projectRoot, '.env.local');
  const envLocalContent = readFileSync(envLocalPath, 'utf-8');
  envLocalContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  });
} catch (e) {
  // .env.local doesn't exist - that's okay, we'll check process.env
}

// Check required environment variables
const requiredVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
];

const missingVars = [];
const presentVars = [];

for (const varName of requiredVars) {
  const value = envVars[varName] || process.env[varName];
  if (!value || value.trim() === '') {
    missingVars.push(varName);
  } else {
    presentVars.push(varName);
  }
}

// Print results
console.log('\n📋 Environment Variables Check\n');

if (presentVars.length > 0) {
  console.log('✅ Configured:');
  presentVars.forEach(varName => {
    const value = envVars[varName] || process.env[varName];
    const masked = varName.includes('KEY') 
      ? `${value.substring(0, 20)}...${value.substring(value.length - 4)}`
      : value;
    console.log(`   ${varName}: ${masked}`);
  });
  console.log('');
}

if (missingVars.length > 0) {
  console.log('❌ Missing:');
  missingVars.forEach(varName => {
    console.log(`   ${varName}`);
  });
  console.log('');
  console.log('💡 Setup Instructions:');
  console.log('   1. Get these values from: Supabase Dashboard → Project Settings → API');
  console.log('   2. Create a .env.local file in the project root');
  console.log('   3. Add the following lines:');
  console.log(`      NEXT_PUBLIC_SUPABASE_URL=`);
  console.log(`      NEXT_PUBLIC_SUPABASE_ANON_KEY=`);
  console.log('   4. Fill in the values');
  console.log('   5. Restart the dev server (npm run dev)');
  console.log('');
  process.exit(1);
}

console.log('✅ All required environment variables are configured!\n');
process.exit(0);