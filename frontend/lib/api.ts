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

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export const createLink = async (originalUrl: string): Promise<ShortLink> => {
  const response = await fetch('/api/links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ originalUrl }),
  });
  return handleResponse<ShortLink>(response);
};

export const getAllLinks = async (): Promise<ShortLink[]> => {
  const response = await fetch('/api/links');
  return handleResponse<ShortLink[]>(response);
};

export const getLinkStats = async (code: string): Promise<LinkStats> => {
  const response = await fetch(`/api/links/${code}/stats`);
  return handleResponse<LinkStats>(response);
};
