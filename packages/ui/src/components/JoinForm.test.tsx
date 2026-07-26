import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JoinForm } from './JoinForm.js';

describe('JoinForm', () => {
  it('submits the entered name and join code', async () => {
    const onSubmit = vi.fn();
    render(<JoinForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/name/i), 'Ada');
    await userEvent.type(screen.getByLabelText(/join code/i), 'RIFF-4F9K-2A7Q');
    await userEvent.click(screen.getByRole('button', { name: /join/i }));
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Ada', code: 'RIFF-4F9K-2A7Q' });
  });

  it('displays an error message when provided', () => {
    render(<JoinForm onSubmit={() => {}} error="Check your join code" />);
    expect(screen.getByText('Check your join code')).toBeInTheDocument();
  });

  it('disables the submit button while busy', () => {
    render(<JoinForm onSubmit={() => {}} busy />);
    expect(screen.getByRole('button', { name: /join/i })).toBeDisabled();
  });
});
