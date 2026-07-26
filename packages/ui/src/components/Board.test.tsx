import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Board } from './Board.js';
import type { BoardState } from '../state/boardReducer.js';
import { capsule, participant } from '../test/fixtures.js';

describe('Board', () => {
  it('renders a card for each capsule', () => {
    const state: BoardState = {
      participants: [participant()],
      capsules: [
        capsule({ id: '33333333-3333-4333-8333-333333333333', objective: 'Angle one' }),
        capsule({ id: '44444444-4444-4444-8444-444444444444', objective: 'Angle two' }),
      ],
    };
    render(<Board state={state} onRiff={() => {}} />);
    expect(screen.getByText('Angle one')).toBeInTheDocument();
    expect(screen.getByText('Angle two')).toBeInTheDocument();
  });

  it('shows an empty state when there are no capsules', () => {
    render(<Board state={{ participants: [participant()], capsules: [] }} onRiff={() => {}} />);
    expect(screen.getByText(/waiting for the first riff/i)).toBeInTheDocument();
  });

  it('renders participant presence', () => {
    const state: BoardState = {
      participants: [participant({ name: 'Grace' })],
      capsules: [],
    };
    render(<Board state={state} onRiff={() => {}} />);
    expect(screen.getByText('Grace')).toBeInTheDocument();
  });
});
