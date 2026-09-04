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

  it('disables Riff on your own card, identified by authorId not by name', () => {
    const me = participant({ id: 'me-id' });
    const state: BoardState = {
      self: { participantId: 'me-id' },
      participants: [me],
      capsules: [
        capsule({
          id: '33333333-3333-4333-8333-333333333333',
          authorId: 'me-id',
          objective: 'Mine',
        }),
        capsule({
          id: '44444444-4444-4444-8444-444444444444',
          authorId: 'someone-else',
          // Same display name as the viewer: name-matching would wrongly disable this.
          author: me.name,
          objective: 'Theirs',
        }),
      ],
    };
    render(<Board state={state} onRiff={() => {}} />);
    const buttons = screen.getAllByRole('button', { name: /riff/i });
    expect(buttons[0]).toBeDisabled(); // my capsule
    expect(buttons[1]).toBeEnabled(); // a namesake's capsule
  });
});
