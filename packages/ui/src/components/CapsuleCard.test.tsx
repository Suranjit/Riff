import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CapsuleCard } from './CapsuleCard.js';
import { capsule } from '../test/fixtures.js';

describe('CapsuleCard', () => {
  it('renders the capsule fields', () => {
    render(<CapsuleCard capsule={capsule()} isOwn={false} onRiff={() => {}} />);
    expect(screen.getByText('Explore the graph model')).toBeInTheDocument();
    expect(screen.getByText('Start from the wire contract')).toBeInTheDocument();
    expect(screen.getByText('CRDTs may be overkill')).toBeInTheDocument();
    expect(screen.getByText('Do we need lineage?')).toBeInTheDocument();
    expect(screen.getByText(/Ada/)).toBeInTheDocument();
  });

  it('shows a lineage badge when lineageLabel is provided', () => {
    render(
      <CapsuleCard
        capsule={capsule({ riffedFrom: '44444444-4444-4444-8444-444444444444' })}
        lineageLabel="riffed from Grace"
        isOwn={false}
        onRiff={() => {}}
      />,
    );
    expect(screen.getByText('riffed from Grace')).toBeInTheDocument();
  });

  it('calls onRiff with the capsule when the Riff button is clicked', async () => {
    const onRiff = vi.fn();
    const c = capsule();
    render(<CapsuleCard capsule={c} isOwn={false} onRiff={onRiff} />);
    await userEvent.click(screen.getByRole('button', { name: /riff/i }));
    expect(onRiff).toHaveBeenCalledWith(c);
  });

  it('disables the Riff button for the viewer’s own capsule', () => {
    render(<CapsuleCard capsule={capsule()} isOwn onRiff={() => {}} />);
    expect(screen.getByRole('button', { name: /riff/i })).toBeDisabled();
  });
});
