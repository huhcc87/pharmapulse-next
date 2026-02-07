#!/usr/bin/env node
/**
 * Script to fix Next.js 15/16 params Promise issue
 * Updates { params: { id: string } } to { params: Promise<{ id: string }> }
 * and adds await params
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find all route.ts files with old params format
const findFiles = () => {
  const result = execSync(
    'find src/app/api -name "route.ts" -type f',
    { encoding: 'utf-8', cwd: process.cwd() }
  );
  return result.trim().split('\n').filter(Boolean);
};

const fixFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;

  // Replace params: { id: string } with params: Promise<{ id: string }>
  const paramPattern = /params\s*:\s*\{\s*id\s*:\s*string\s*\}/g;
  if (paramPattern.test(content)) {
    content = content.replace(paramPattern, 'params: Promise<{ id: string }>');
    modified = true;
  }

  // Find function signatures and add await params
  const functionPattern = /export\s+async\s+function\s+(\w+)\s*\([^)]*\{[\s\n]*params[\s\n]*:[\s\n]*Promise<\{[\s\n]*id[\s\n]*:[\s\n]*string[\s\n]*\}>[\s\n]*\}[^)]*\)\s*\{([^}]*?)const\s+\{\s*id\s*\}\s*=\s*params;/gs;
  
  if (functionPattern.test(content)) {
    content = content.replace(
      /const\s+\{\s*id\s*\}\s*=\s*params;/g,
      'const resolvedParams = await params;\n    const { id } = resolvedParams;'
    );
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Fixed: ${filePath}`);
    return true;
  }
  return false;
};

const files = findFiles();
let fixed = 0;

files.forEach(file => {
  if (fixFile(file)) {
    fixed++;
  }
});

console.log(`\nFixed ${fixed} files.`);
