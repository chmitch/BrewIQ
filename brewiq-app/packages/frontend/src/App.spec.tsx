import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const batches = vi.hoisted(() => ({
  state: {
    items: [] as unknown[],
    status: 'ready' as 'ready' | 'loading' | 'error',
    error: null as string | null,
    pending: false,
    createBatch: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    refresh: vi.fn(),
    clearError: vi.fn(),
  },
}));

vi.mock('@/hooks/use-batches', () => ({ useBatches: () => batches.state }));

import App from '@/App';

describe('App', () => {
  it('invites the first batch when there are none', () => {
    batches.state.items = [];
    render(<App />);
    expect(screen.getByText('Nothing fermenting')).toBeInTheDocument();
    expect(screen.getByText('No completed batches yet')).toBeInTheDocument();
  });

  it('lists active and completed batches separately', () => {
    const base = {
      yeast: 'US-05',
      targetOGPoints: 1050,
      owner_id: 'u1',
      startDate: new Date('2026-10-01T12:00:00Z'),
    };
    batches.state.items = [
      { ...base, id: '1', name: 'Pale Ale', endDate: null },
      { ...base, id: '2', name: 'Old Stout', endDate: new Date('2026-10-20T12:00:00Z') },
    ];
    render(<App />);
    expect(screen.getByText('Pale Ale')).toBeInTheDocument();
    expect(screen.getByText('Old Stout')).toBeInTheDocument();
    expect(screen.queryByText('Nothing fermenting')).not.toBeInTheDocument();
  });
});
