-- Add Mobile App Statistics Table
-- This table stores real app statistics that can be updated over time

CREATE TABLE IF NOT EXISTS app_stats (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  active_users INT NOT NULL DEFAULT 0,
  app_rating DECIMAL(3, 1), -- 0.0 to 5.0
  total_downloads INT NOT NULL DEFAULT 0,
  uptime_percent DECIMAL(5, 2), -- 0.00 to 100.00
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT, -- User who last updated
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_app_stats_last_updated ON app_stats(last_updated);

-- Insert initial empty stats record
INSERT INTO app_stats (active_users, total_downloads) VALUES (0, 0)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE app_stats IS 'Mobile app statistics - real data that can be updated over time';
COMMENT ON COLUMN app_stats.active_users IS 'Number of active users';
COMMENT ON COLUMN app_stats.app_rating IS 'App rating (0.0 to 5.0)';
COMMENT ON COLUMN app_stats.total_downloads IS 'Total number of downloads';
COMMENT ON COLUMN app_stats.uptime_percent IS 'Uptime percentage (0.00 to 100.00)';
