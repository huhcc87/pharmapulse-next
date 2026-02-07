# Next.js 15 Upgrade Plan

## Current Version
- Next.js: `^14.2.0` (14.2.35)
- React: `^18.2.0`
- React DOM: `^18.2.0`

## Target Version
- Next.js: `15.x` (latest)
- React: `19.x` (required for Next.js 15)
- React DOM: `19.x` (required for Next.js 15)

## Breaking Changes to Address

### 1. React 19 Requirements
- ✅ Update React to 19.x
- ✅ Update React DOM to 19.x
- ✅ Update @types/react and @types/react-dom
- ⚠️ Check for `useFormState` usage (deprecated, replaced by `useActionState`)

### 2. Async Request APIs
These APIs are now async and need to be awaited:
- `cookies()` → `await cookies()`
- `headers()` → `await headers()`
- `draftMode()` → `await draftMode()`
- `params` → `await params`
- `searchParams` → `await searchParams`

**Files to update:**
- API routes using `cookies()` or `headers()`
- Server components using `params` or `searchParams`
- Pages using `params` or `searchParams`

### 3. Configuration Changes
- ✅ No `experimental-edge` found
- ⚠️ Check for `bundlePagesExternals` → rename to `bundlePagesRouterDependencies`
- ⚠️ Check for `serverComponentsExternalPackages` → rename to `serverExternalPackages`

### 4. Fetch Cache Behavior
- ⚠️ `fetch` requests are no longer cached by default
- Add `cache: 'force-cache'` where needed

---

## Upgrade Steps

1. **Update package.json dependencies**
2. **Run npm install**
3. **Update async API calls** (cookies, headers, params, searchParams)
4. **Update configuration files**
5. **Test the application**
6. **Run codemod if needed**
