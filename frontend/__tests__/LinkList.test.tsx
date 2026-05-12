import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import LinkList from '@/components/LinkList';
import * as api from '@/lib/api';

// Mock the API module
jest.mock('@/lib/api');

// Mock Next.js Link component
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
});

// Mock Next.js navigation hooks (not used in LinkList but imported by other components)
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useParams: jest.fn(),
}));

const mockGetAllLinks = api.getAllLinks as jest.MockedFunction<typeof api.getAllLinks>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('LinkList', () => {
  it('shows loading state initially', () => {
    mockGetAllLinks.mockReturnValue(new Promise(() => {})); // Never resolves

    render(<LinkList refresh={0} />);
    expect(screen.getByText('Loading links...')).toBeInTheDocument();
  });

  it('shows empty state when no links', async () => {
    mockGetAllLinks.mockResolvedValue({
      data: [],
      pagination: { total: 0, totalPages: 1, page: 1, pageSize: 20 },
    });

    render(<LinkList refresh={0} />);

    await waitFor(() => {
      expect(screen.getByText(/No links yet/)).toBeInTheDocument();
    });
  });

  it('renders link list with data', async () => {
    const mockLinks = [
      {
        code: 'abc123',
        shortUrl: 'http://short/abc123',
        originalUrl: 'https://example.com',
        totalClicks: 5,
        createdAt: new Date('2024-01-01').toISOString(),
      },
    ];

    mockGetAllLinks.mockResolvedValue({
      data: mockLinks,
      pagination: { total: 1, totalPages: 1, page: 1, pageSize: 20 },
    });

    render(<LinkList refresh={0} />);

    await waitFor(() => {
      expect(screen.getByText('abc123')).toBeInTheDocument();
    });

    expect(screen.getByText('5 clicks')).toBeInTheDocument();
    expect(screen.getByText('http://short/abc123')).toBeInTheDocument();
    expect(screen.getByText(/example\.com/)).toBeInTheDocument();
  });

  it('shows error state on fetch failure', async () => {
    mockGetAllLinks.mockRejectedValue(new Error('Network error'));

    render(<LinkList refresh={0} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load links')).toBeInTheDocument();
    });
  });

  it('displays pagination when multiple pages', async () => {
    mockGetAllLinks.mockResolvedValue({
      data: [
        {
          code: 'abc123',
          shortUrl: 'http://short/abc123',
          originalUrl: 'https://example.com',
          totalClicks: 5,
          createdAt: new Date().toISOString(),
        },
      ],
      pagination: { total: 50, totalPages: 3, page: 1, pageSize: 20 },
    });

    render(<LinkList refresh={0} />);

    await waitFor(() => {
      expect(screen.getByText('1 / 3')).toBeInTheDocument();
    });

    expect(screen.getByText('← Prev')).toBeDisabled();
    expect(screen.getByText('Next →')).not.toBeDisabled();
  });

  it('resets to page 1 when refresh prop changes', async () => {
    mockGetAllLinks.mockResolvedValue({
      data: [],
      pagination: { total: 0, totalPages: 1, page: 1, pageSize: 20 },
    });

    const { rerender } = render(<LinkList refresh={0} />);

    await waitFor(() => {
      expect(mockGetAllLinks).toHaveBeenCalledWith(1, 20);
    });

    // Change refresh prop
    rerender(<LinkList refresh={1} />);

    await waitFor(() => {
      expect(mockGetAllLinks).toHaveBeenCalledTimes(2);
      expect(mockGetAllLinks).toHaveBeenLastCalledWith(1, 20);
    });
  });

  it('displays total links count', async () => {
    mockGetAllLinks.mockResolvedValue({
      data: [
        {
          code: 'abc123',
          shortUrl: 'http://short/abc123',
          originalUrl: 'https://example.com',
          totalClicks: 5,
          createdAt: new Date().toISOString(),
        },
      ],
      pagination: { total: 42, totalPages: 3, page: 1, pageSize: 20 },
    });

    render(<LinkList refresh={0} />);

    await waitFor(() => {
      expect(screen.getByText('42 links total')).toBeInTheDocument();
    });
  });
});
