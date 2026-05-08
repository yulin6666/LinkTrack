'use client';

import { useEffect, useState } from 'react';
import { getAllLinks, ShortLink } from '@/lib/api';
import Link from 'next/link';

interface LinkListProps {
  refresh: number;
}

export default function LinkList({ refresh }: LinkListProps) {
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchLinks();
  }, [refresh]);

  const fetchLinks = async () => {
    try {
      setLoading(true);
      const data = await getAllLinks();
      setLinks(data);
      setError('');
    } catch (err: any) {
      setError('Failed to load links');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Your Links</h2>

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
    </div>
  );
}
