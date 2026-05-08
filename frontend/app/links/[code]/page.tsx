'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getLinkStats, LinkStats } from '@/lib/api';
import Link from 'next/link';

export default function LinkStatsPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [stats, setStats] = useState<LinkStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (code) {
      fetchStats();
    }
  }, [code]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await getLinkStats(code);
      setStats(data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load stats');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center text-gray-600">Loading stats...</div>
        </div>
      </main>
    );
  }

  if (error || !stats) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-center text-red-600 mb-4">
              {error || 'Link not found'}
            </div>
            <div className="text-center">
              <Link
                href="/"
                className="text-blue-600 hover:underline"
              >
                ← Back to home
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/"
            className="text-blue-600 hover:underline inline-flex items-center"
          >
            ← Back to home
          </Link>
        </div>

        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            Link Statistics
          </h1>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Short Code
              </label>
              <div className="font-mono text-lg bg-blue-100 text-blue-800 px-3 py-2 rounded inline-block">
                {stats.code}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Short URL
              </label>
              <a
                href={stats.shortUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-lg"
              >
                {stats.shortUrl}
              </a>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Original URL
              </label>
              <a
                href={stats.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-700 hover:underline break-all"
              >
                {stats.originalUrl}
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg">
                <div className="text-sm font-medium text-gray-600 mb-2">
                  Total Clicks
                </div>
                <div className="text-4xl font-bold text-blue-600">
                  {stats.totalClicks.toLocaleString()}
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg">
                <div className="text-sm font-medium text-gray-600 mb-2">
                  Last Clicked
                </div>
                <div className="text-lg font-semibold text-green-700">
                  {stats.lastClickedAt
                    ? new Date(stats.lastClickedAt).toLocaleString()
                    : 'Never'}
                </div>
              </div>
            </div>

            <div className="pt-6 border-t">
              <div className="text-sm text-gray-500">
                Created: {new Date(stats.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
