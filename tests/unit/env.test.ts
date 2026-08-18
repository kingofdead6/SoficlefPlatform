import { describe, expect, it } from 'vitest';

import { __serverSchema } from '@/lib/env';

describe('server environment', () => {
  it('rejects a missing database URL rather than starting half-configured', () => {
    const result = __serverSchema.safeParse({ NODE_ENV: 'test' });
    expect(result.success).toBe(false);
  });

  it('rejects a database URL that is not a URL', () => {
    const result = __serverSchema.safeParse({ NODE_ENV: 'test', DATABASE_URL: 'localhost:5432' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid configuration and defaults the app URL', () => {
    const result = __serverSchema.safeParse({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user@localhost:5432/soficlef',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.APP_URL).toBe('http://localhost:3000');
  });
});
