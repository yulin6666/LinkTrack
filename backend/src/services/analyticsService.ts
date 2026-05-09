import { UAParser } from 'ua-parser-js';
import geoip from 'geoip-lite';

export interface ParsedClickData {
  country: string | null;
  city: string | null;
  deviceType: string | null;
  os: string | null;
  browser: string | null;
}

class AnalyticsService {
  parseUserAgent(userAgent: string): { deviceType: string | null; os: string | null; browser: string | null } {
    try {
      const parser = new UAParser(userAgent);
      const result = parser.getResult();

      return {
        deviceType: result.device.type || 'desktop',
        os: result.os.name || null,
        browser: result.browser.name || null,
      };
    } catch (error) {
      console.error('Error parsing user agent:', error);
      return { deviceType: null, os: null, browser: null };
    }
  }

  parseIP(ip: string): { country: string | null; city: string | null } {
    try {
      // Remove IPv6 prefix if present
      const cleanIP = ip.replace(/^::ffff:/, '');

      const geo = geoip.lookup(cleanIP);

      if (!geo) {
        return { country: null, city: null };
      }

      return {
        country: geo.country || null,
        city: geo.city || null,
      };
    } catch (error) {
      console.error('Error parsing IP:', error);
      return { country: null, city: null };
    }
  }

  parseReferer(referer: string): string {
    if (!referer || referer === 'direct') {
      return 'Direct';
    }

    try {
      const url = new URL(referer);
      const hostname = url.hostname.toLowerCase();

      // WeChat
      if (hostname.includes('weixin') || hostname.includes('wechat')) {
        return 'WeChat';
      }

      // Weibo
      if (hostname.includes('weibo')) {
        return 'Weibo';
      }

      // Douyin/TikTok
      if (hostname.includes('douyin') || hostname.includes('tiktok')) {
        return 'Douyin';
      }

      // Xiaohongshu
      if (hostname.includes('xiaohongshu') || hostname.includes('xhs')) {
        return 'Xiaohongshu';
      }

      // Google
      if (hostname.includes('google')) {
        return 'Google';
      }

      // Facebook
      if (hostname.includes('facebook') || hostname.includes('fb.')) {
        return 'Facebook';
      }

      // Twitter/X
      if (hostname.includes('twitter') || hostname.includes('t.co')) {
        return 'Twitter';
      }

      // Return domain name for others
      return hostname.replace('www.', '');
    } catch (error) {
      return 'Unknown';
    }
  }

  parseClickEvent(ip: string, userAgent: string, referer: string): ParsedClickData {
    const { country, city } = this.parseIP(ip);
    const { deviceType, os, browser } = this.parseUserAgent(userAgent);

    return {
      country,
      city,
      deviceType,
      os,
      browser,
    };
  }
}

export default new AnalyticsService();
