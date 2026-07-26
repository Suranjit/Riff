import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectPanel } from './ConnectPanel.js';

const COMMAND = 'npx riffboard join "https://host:4747/room/abc#c=RIFF-XXXX-YYYY"';

describe('ConnectPanel', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('offers a Connect Claude Code action', () => {
    render(<ConnectPanel command={COMMAND} />);
    expect(screen.getByRole('button', { name: /connect claude code/i })).toBeInTheDocument();
  });

  it('copies the command to the clipboard and confirms', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    render(<ConnectPanel command={COMMAND} />);
    await userEvent.click(screen.getByRole('button', { name: /connect claude code/i }));

    expect(writeText).toHaveBeenCalledWith(COMMAND);
    expect(await screen.findByText(/copied/i)).toBeInTheDocument();
  });
});
