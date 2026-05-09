'use client';

import { useEffect, useRef, useState } from 'react';
import { getAllLinks, ShortLink } from '@/lib/api';
import Link from 'next/link';

interface LinkListProps {
  refresh: number;
}

export default function LinkList({ refresh }: LinkListProps) {
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;
  const prevRefreshRef = useRef(refresh);

  useEffect(() => {
    const controller = new AbortController();

    // refresh 变化时重置到第1页
    const isRefreshChange = prevRefreshRef.current !== refresh;
    const fetchPage = isRefreshChange ? 1 : page;
    if (isRefreshChange) {
      prevRefreshRef.current = refresh;
      setPage(1);
    }

    const fetchLinks = async () => {
      try {
        setLoading(true);
        const result = await getAllLinks(fetchPage, pageSize);
        if (!controller.signal.aborted) {
          setLinks(result.data);
          setTotalPages(result.pagination.totalPages);
          setTotal(result.pagination.total);
          setError('');
        }
      } catch (err: any) {
        if (!controller.signal.aborted) {
          setError('Failed to load links');
          console.error(err);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchLinks();
    return () => controller.abort();
  }, [page, refresh]);

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6">
        <div className="text-center text-gray-600">Loading links...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6">
        <div className="text-center text-red-600">{error}</div>
      </div>
    );
  }

  if (links.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6">
        <div className="text-center text-gray-600">
          No links yet. Create your first short link above!
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Your Links</h2>
        <span className="text-sm text-gray-500">{total} links total</span>
      </div>

      <div className="space-y-4">
        {links.map((link) => (
          <div
            key={link.code}
            className="bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {link.code}
                  </span>
                  <span className="text-gray-500 text-sm">
                    {link.totalClicks || 0} clicks
                  </span>
                </div>

                <a
                  href={link.shortUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-medium block mb-1"
                >
                  {link.shortUrl}
                </a>

                <p className="text-gray-600 text-sm truncate">
                  → {link.originalUrl}
                </p>

                <p className="text-gray-400 text-xs mt-2">
                  Created: {new Date(link.createdAt).toLocaleString()}
                </p>
              </div>

              <Link
                href={`/links/${link.code}`}
                className="ml-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm"
              >
                View Stats
              </Link>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => p - 1)}
            disabled={page === 1}
            className="px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Prev
          </button>

          <span className="text-sm text-gray-600">
            {page} / {totalPages}
          </span>

          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page === totalPages}
            className="px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

