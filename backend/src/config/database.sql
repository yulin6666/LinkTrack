-- Short links table
CREATE TABLE short_links (
  id SERIAL PRIMARY KEY,
  code VARCHAR(10) UNIQUE NOT NULL,
  original_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_short_links_code ON short_links(code);
CREATE INDEX idx_short_links_created_at ON short_links(created_at DESC);

-- Click logs table (raw events)
CREATE TABLE click_logs (
  id SERIAL PRIMARY KEY,
  link_id INTEGER REFERENCES short_links(id) ON DELETE CASCADE,
  clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT,
  referer TEXT
);

CREATE INDEX idx_click_logs_link_id ON click_logs(link_id);
CREATE INDEX idx_click_logs_clicked_at ON click_logs(clicked_at DESC);

-- Click stats table (aggregated)
CREATE TABLE click_stats (
  id SERIAL PRIMARY KEY,
  link_id INTEGER UNIQUE REFERENCES short_links(id) ON DELETE CASCADE,
  total_clicks INTEGER DEFAULT 0,
  last_clicked_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_click_stats_link_id ON click_stats(link_id);
