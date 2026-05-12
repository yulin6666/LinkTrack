import analyticsService from '../services/analyticsService';

describe('AnalyticsService', () => {
  describe('parseUserAgent', () => {
    it('returns desktop for unknown device', () => {
      const result = analyticsService.parseUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
      );
      expect(result.deviceType).toBe('desktop');
      expect(result.os).toBe('Windows');
      expect(result.browser).toBe('Chrome');
    });

    it('detects mobile device', () => {
      const result = analyticsService.parseUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
      );
      expect(result.deviceType).toBe('mobile');
      expect(result.os).toBe('iOS');
    });

    it('returns nulls for empty user agent', () => {
      const result = analyticsService.parseUserAgent('');
      expect(result.deviceType).toBe('desktop');
    });
  });

  describe('parseIP', () => {
    it('returns nulls for localhost', () => {
      const result = analyticsService.parseIP('127.0.0.1');
      expect(result.country).toBeNull();
      expect(result.city).toBeNull();
    });

    it('strips IPv6 prefix before lookup', () => {
      // ::ffff:127.0.0.1 should be treated as 127.0.0.1
      const result = analyticsService.parseIP('::ffff:127.0.0.1');
      expect(result.country).toBeNull();
    });

    it('returns nulls for invalid IP', () => {
      const result = analyticsService.parseIP('not-an-ip');
      expect(result.country).toBeNull();
      expect(result.city).toBeNull();
    });
  });

  describe('parseReferer', () => {
    it('returns Direct for empty referer', () => {
      expect(analyticsService.parseReferer('')).toBe('Direct');
      expect(analyticsService.parseReferer('direct')).toBe('Direct');
    });

    it('identifies Google', () => {
      expect(analyticsService.parseReferer('https://www.google.com/search?q=test')).toBe('Google');
    });

    it('identifies Twitter', () => {
      expect(analyticsService.parseReferer('https://t.co/abc123')).toBe('Twitter');
      expect(analyticsService.parseReferer('https://twitter.com/home')).toBe('Twitter');
    });

    it('identifies WeChat', () => {
      expect(analyticsService.parseReferer('https://mp.weixin.qq.com/s/abc')).toBe('WeChat');
    });

    it('identifies Douyin', () => {
      expect(analyticsService.parseReferer('https://www.douyin.com/video/123')).toBe('Douyin');
    });

    it('returns hostname for unknown referer', () => {
      expect(analyticsService.parseReferer('https://example.com/page')).toBe('example.com');
    });

    it('returns Unknown for malformed URL', () => {
      expect(analyticsService.parseReferer('not-a-url')).toBe('Unknown');
    });
  });

  describe('parseClickEvent', () => {
    it('combines IP and UA parsing', () => {
      const result = analyticsService.parseClickEvent(
        '127.0.0.1',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
        'https://google.com'
      );
      expect(result).toHaveProperty('country');
      expect(result).toHaveProperty('city');
      expect(result).toHaveProperty('deviceType');
      expect(result).toHaveProperty('os');
      expect(result).toHaveProperty('browser');
    });
  });
});
