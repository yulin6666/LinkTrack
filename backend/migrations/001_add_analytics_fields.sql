-- Add analytics fields to click_logs table
ALTER TABLE click_logs
ADD COLUMN IF NOT EXISTS country VARCHAR(50),
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS device_type VARCHAR(20),
ADD COLUMN IF NOT EXISTS os VARCHAR(50),
ADD COLUMN IF NOT EXISTS browser VARCHAR(50);

-- Add indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_click_logs_country ON click_logs(country);
CREATE INDEX IF NOT EXISTS idx_click_logs_device_type ON click_logs(device_type);
CREATE INDEX IF NOT EXISTS idx_click_logs_os ON click_logs(os);
