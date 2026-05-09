CREATE TABLE IF NOT EXISTS short_links (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  original_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_short_links_code ON short_links(code);

CREATE TABLE IF NOT EXISTS click_logs (
  id SERIAL PRIMARY KEY,
  link_id INTEGER REFERENCES short_links(id) ON DELETE CASCADE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  referer TEXT,
  country VARCHAR(50),
  city VARCHAR(100),
  device_type VARCHAR(20),
  os VARCHAR(50),
  browser VARCHAR(50),
  clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_click_logs_link_id ON click_logs(link_id);
CREATE INDEX IF NOT EXISTS idx_click_logs_country ON click_logs(country);
CREATE INDEX IF NOT EXISTS idx_click_logs_device_type ON click_logs(device_type);
CREATE INDEX IF NOT EXISTS idx_click_logs_os ON click_logs(os);

CREATE TABLE IF NOT EXISTS click_stats (
  id SERIAL PRIMARY KEY,
  link_id INTEGER UNIQUE REFERENCES short_links(id) ON DELETE CASCADE,
  total_clicks INTEGER DEFAULT 0,
  last_clicked_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
