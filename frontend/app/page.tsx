'use client';

import { useState } from 'react';
import LinkForm from '@/components/LinkForm';
import LinkList from '@/components/LinkList';

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleLinkCreated = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            LinkTrack
          </h1>
          <p className="text-xl text-gray-600">
            High-performance URL shortener with real-time analytics
          </p>
        </div>

        <div className="mb-12">
          <LinkForm onLinkCreated={handleLinkCreated} />
        </div>

        <LinkList refresh={refreshKey} />
      </div>
    </main>
  );
}
