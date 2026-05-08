'use client';

import { useState } from 'react';
import { createLink } from '@/lib/api';

interface LinkFormProps {
  onLinkCreated: () => void;
}

export default function LinkForm({ onLinkCreated }: LinkFormProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [shortUrl, setShortUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setShortUrl('');

    if (!url) {
      setError('Please enter a URL');
      return;
    }

    setLoading(true);

    try {
      const link = await createLink(url);
      setShortUrl(link.shortUrl);
      setSuccess('Short link created successfully!');
      setUrl('');
      onLinkCreated();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create short link');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shortUrl);
    setSuccess('Copied to clipboard!');
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Create Short Link</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
            Original URL
          </label>
          <input
            type="url"
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/very/long/url"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Creating...' : 'Shorten URL'}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {success && shortUrl && (
        <div className="mt-4 p-4 bg-green-100 border border-green-400 rounded-md">
          <p className="text-green-700 font-medium mb-2">{success}</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={shortUrl}
              readOnly
              className="flex-1 px-3 py-2 bg-white border border-green-300 rounded-md text-sm"
            />
            <button
              onClick={copyToClipboard}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
