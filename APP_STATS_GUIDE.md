# Mobile App Statistics Guide

## Overview

The Mobile App page now displays real statistics that can be updated over time. The stats are stored in the database and can be managed by admins.

## Statistics Tracked

1. **Active Users** - Number of active users
2. **App Rating** - App store rating (0.0 to 5.0)
3. **Total Downloads** - Total number of app downloads
4. **Uptime** - Service uptime percentage (0.00 to 100.00)

## Setup

### 1. Run Database Migration

```bash
psql $DATABASE_URL -f prisma/migrations/add_app_stats.sql
npx prisma generate
```

### 2. Initial State

When first loaded, all stats will show "—" (dash) indicating no data yet. As you update the stats, they will display real numbers.

## Updating Statistics

### Via API (Admin Only)

Only users with `owner` or `super_admin` role can update stats.

**Update Stats:**
```bash
curl -X PUT http://localhost:3000/api/mobile/stats \
  -H "Content-Type: application/json" \
  -H "Cookie: pp_tenant=your-tenant-id; pp_user=your-user-id; pp_role=owner" \
  -d '{
    "activeUsers": 1000,
    "appRating": 4.8,
    "totalDownloads": 5000,
    "uptimePercent": 99.9
  }'
```

**Get Current Stats:**
```bash
curl http://localhost:3000/api/mobile/stats
```

### Via Database (Direct)

You can also update directly in the database:

```sql
-- Update stats
UPDATE app_stats 
SET 
  active_users = 1000,
  app_rating = 4.8,
  total_downloads = 5000,
  uptime_percent = 99.9,
  last_updated = NOW(),
  updated_by = 'admin-user-id'
WHERE id = (SELECT id FROM app_stats ORDER BY created_at DESC LIMIT 1);
```

## Display Format

- **Active Users**: Shows as "1K+", "10K+", "1M+" etc. if >= 1000
- **App Rating**: Shows as "4.8★" (one decimal place)
- **Total Downloads**: Shows as "5K+", "50K+" etc. if >= 1000
- **Uptime**: Shows as "99.9%" (one decimal place)

## Empty State

When stats are 0 or null, the page displays "—" (dash) instead of fake numbers. This makes it clear that real data will be populated over time.

## Best Practices

1. **Update Regularly**: Update stats monthly or quarterly as your app grows
2. **Use Real Data**: Only update with actual numbers from your analytics
3. **Track Sources**: Keep track of where your numbers come from (App Store, Google Play, analytics dashboard)
4. **Be Honest**: Don't inflate numbers - users appreciate transparency

## Future Enhancements

- Automatic updates from app store APIs
- Integration with analytics platforms
- Historical tracking (stats over time)
- Admin UI for easy updates

## API Endpoints

- `GET /api/mobile/stats` - Get current statistics (public)
- `PUT /api/mobile/stats` - Update statistics (admin only)

## Example Updates

### Initial Launch
```json
{
  "activeUsers": 0,
  "appRating": null,
  "totalDownloads": 0,
  "uptimePercent": null
}
```

### After 1 Month
```json
{
  "activeUsers": 150,
  "appRating": 4.5,
  "totalDownloads": 500,
  "uptimePercent": 99.5
}
```

### After 6 Months
```json
{
  "activeUsers": 1200,
  "appRating": 4.8,
  "totalDownloads": 5000,
  "uptimePercent": 99.9
}
```
