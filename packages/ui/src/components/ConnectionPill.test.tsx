import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConnectionPill } from './ConnectionPill.js';

describe('ConnectionPill', () => {
  it('shows Live when the connection is open', () => {
    render(<ConnectionPill state="open" />);
    expect(screen.getByText(/live/i)).toBeInTheDocument();
  });

  it('shows Connecting while connecting', () => {
    render(<ConnectionPill state="connecting" />);
    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });

  it('shows Disconnected when closed', () => {
    render(<ConnectionPill state="closed" />);
    expect(screen.getByText(/disconnected/i)).toBeInTheDocument();
  });

  it('shows Disconnected on error', () => {
    render(<ConnectionPill state="error" />);
    expect(screen.getByText(/disconnected/i)).toBeInTheDocument();
  });
});
