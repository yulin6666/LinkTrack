-- Ensure all analytics fields exist in click_logs table
-- This migration is idempotent and safe to run multiple times

DO $$
BEGIN
    -- Add country column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'click_logs' AND column_name = 'country'
    ) THEN
        ALTER TABLE click_logs ADD COLUMN country VARCHAR(50);
    END IF;

    -- Add city column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'click_logs' AND column_name = 'city'
    ) THEN
        ALTER TABLE click_logs ADD COLUMN city VARCHAR(100);
    END IF;

    -- Add device_type column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'click_logs' AND column_name = 'device_type'
    ) THEN
        ALTER TABLE click_logs ADD COLUMN device_type VARCHAR(20);
    END IF;

    -- Add os column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'click_logs' AND column_name = 'os'
    ) THEN
        ALTER TABLE click_logs ADD COLUMN os VARCHAR(50);
    END IF;

    -- Add browser column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'click_logs' AND column_name = 'browser'
    ) THEN
        ALTER TABLE click_logs ADD COLUMN browser VARCHAR(50);
    END IF;
END $$;

-- Create indexes if they don't exist (idempotent)
CREATE INDEX IF NOT EXISTS idx_click_logs_country ON click_logs(country);
CREATE INDEX IF NOT EXISTS idx_click_logs_device_type ON click_logs(device_type);
CREATE INDEX IF NOT EXISTS idx_click_logs_os ON click_logs(os);
CREATE INDEX IF NOT EXISTS idx_click_logs_browser ON click_logs(browser);
CREATE INDEX IF NOT EXISTS idx_click_logs_city ON click_logs(city);
