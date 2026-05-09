export interface ShortLink {
  code: string;
  shortUrl: string;
  originalUrl: string;
  totalClicks?: number;
  lastClickedAt?: string | null;
  createdAt: string;
}

export interface LinkStats {
  code: string;
  shortUrl: string;
  originalUrl: string;
  totalClicks: number;
  lastClickedAt: string | null;
  createdAt: string;
}

export interface AnalyticsData {
  devices: { type: string; count: number }[];
  os: { name: string; count: number }[];
  browsers: { name: string; count: number }[];
  countries: { name: string; count: number }[];
  cities: { name: string; country: string; count: number }[];
  referers: { source: string; count: number }[];
}

export interface PaginatedLinks {
  data: ShortLink[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface TrendData {
  time: string;
  clicks: number;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export const createLink = async (originalUrl: string): Promise<ShortLink> => {
  const response = await fetch('/api/v1/links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ originalUrl }),
  });
  return handleResponse<ShortLink>(response);
};

export const getAllLinks = async (page: number = 1, pageSize: number = 20): Promise<PaginatedLinks> => {
  const response = await fetch(`/api/v1/links?page=${page}&pageSize=${pageSize}`);
  return handleResponse<PaginatedLinks>(response);
};

export const getLinkStats = async (code: string): Promise<LinkStats> => {
  const response = await fetch(`/api/v1/links/${code}/stats`);
  return handleResponse<LinkStats>(response);
};

export const getLinkAnalytics = async (code: string): Promise<AnalyticsData> => {
  const response = await fetch(`/api/v1/analytics/${code}/analytics`);
  return handleResponse<AnalyticsData>(response);
};

export const getLinkTrend = async (code: string, days: number = 7): Promise<TrendData[]> => {
  const response = await fetch(`/api/v1/analytics/${code}/trend?days=${days}`);
  const data = await handleResponse<{ trend: TrendData[] }>(response);
  return data.trend;
};
