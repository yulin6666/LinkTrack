'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getLinkStats, getLinkAnalytics, getLinkTrend, LinkStats, AnalyticsData, TrendData } from '@/lib/api';
import Link from 'next/link';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function LinkStatsPage() {
  const params = useParams();
  const router = useRouter();
  const code = (Array.isArray(params.code) ? params.code[0] : params.code) as string;

  const [stats, setStats] = useState<LinkStats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [trend, setTrend] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (code) {
      const controller = new AbortController();
      fetchStats(controller);
      return () => controller.abort();
    }
  }, [code]);

  const fetchStats = async (controller: AbortController) => {
    try {
      setLoading(true);
      const [statsData, analyticsData, trendData] = await Promise.all([
        getLinkStats(code),
        getLinkAnalytics(code),
        getLinkTrend(code, 7),
      ]);
      if (!controller.signal.aborted) {
        setStats(statsData);
        setAnalytics(analyticsData);
        setTrend(trendData);
        setError('');
      }
    } catch (err: any) {
      if (!controller.signal.aborted) {
        setError(err.message || 'Failed to load stats');
        console.error(err);
      }
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

        {analytics && (
          <>
            {/* Click Trend Chart */}
            {trend.length > 0 && (
              <div className="bg-white p-8 rounded-lg shadow-md mt-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Click Trend (Last 7 Days)
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="time"
                      tickFormatter={(value) => new Date(value).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit' })}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(value) => new Date(value).toLocaleString('zh-CN')}
                    />
                    <Area type="monotone" dataKey="clicks" stroke="#3b82f6" fill="#93c5fd" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Traffic Sources */}
            {analytics.referers.length > 0 && (
              <div className="bg-white p-8 rounded-lg shadow-md mt-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Traffic Sources
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.referers}
                      dataKey="count"
                      nameKey="source"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {analytics.referers.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Device Types */}
            {analytics.devices.length > 0 && (
              <div className="bg-white p-8 rounded-lg shadow-md mt-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Device Types
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.devices}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Operating Systems */}
            {analytics.os.length > 0 && (
              <div className="bg-white p-8 rounded-lg shadow-md mt-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Operating Systems
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.os}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Browsers */}
            {analytics.browsers.length > 0 && (
              <div className="bg-white p-8 rounded-lg shadow-md mt-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Browsers
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.browsers}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Geographic Distribution */}
            {(analytics.countries.length > 0 || analytics.cities.length > 0) && (
              <div className="bg-white p-8 rounded-lg shadow-md mt-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Geographic Distribution
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {analytics.countries.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-700 mb-4">Countries</h3>
                      <div className="space-y-2">
                        {analytics.countries.map((country, idx) => (
                          <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span className="text-gray-700">{country.name}</span>
                            <span className="font-semibold text-blue-600">{country.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {analytics.cities.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-700 mb-4">Cities</h3>
                      <div className="space-y-2">
                        {analytics.cities.map((city, idx) => (
                          <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span className="text-gray-700">{city.name}</span>
                            <span className="font-semibold text-blue-600">{city.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

