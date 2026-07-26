import { defineWorkspace } from 'vitest/config';

// Each package under packages/* that ships a vitest/vite config is
// automatically included as a workspace project.
export default defineWorkspace(['packages/*']);
