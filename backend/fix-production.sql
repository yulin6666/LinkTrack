-- Quick fix for Railway production database
-- Execute this SQL directly in Railway PostgreSQL Query interface

-- Add missing analytics columns to click_logs table
ALTER TABLE click_logs ADD COLUMN IF NOT EXISTS country VARCHAR(50);
ALTER TABLE click_logs ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE click_logs ADD COLUMN IF NOT EXISTS device_type VARCHAR(20);
ALTER TABLE click_logs ADD COLUMN IF NOT EXISTS os VARCHAR(50);
ALTER TABLE click_logs ADD COLUMN IF NOT EXISTS browser VARCHAR(50);

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_click_logs_country ON click_logs(country);
CREATE INDEX IF NOT EXISTS idx_click_logs_city ON click_logs(city);
CREATE INDEX IF NOT EXISTS idx_click_logs_device_type ON click_logs(device_type);
CREATE INDEX IF NOT EXISTS idx_click_logs_os ON click_logs(os);
CREATE INDEX IF NOT EXISTS idx_click_logs_browser ON click_logs(browser);

-- Verify the fix
SELECT
    column_name,
    data_type,
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'click_logs'
    AND column_name IN ('country', 'city', 'device_type', 'os', 'browser')
ORDER BY column_name;
