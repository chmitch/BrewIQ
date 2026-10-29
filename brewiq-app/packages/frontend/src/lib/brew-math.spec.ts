import { describe, expect, it } from 'vitest';

import { abv, attenuation } from '@/lib/brew-math';
import { markUtc, toDaxDateTime } from '@/lib/dax-datetime';

describe('brew math', () => {
  it('computes ABV and attenuation from OG and current gravity', () => {
    expect(abv(1.05, 1.01)).toBeCloseTo(5.25, 2);
    expect(attenuation(1.05, 1.01)).toBeCloseTo(80, 5);
  });

  it('never goes negative or divides by zero', () => {
    expect(abv(1.05, 1.06)).toBe(0);
    expect(attenuation(1.0, 1.0)).toBeNull();
  });
});

describe('dax datetime', () => {
  it('emits UTC components', () => {
    expect(toDaxDateTime(new Date('2026-10-24T14:27:05Z'))).toBe(
      '(DATE(2026,10,24)+TIME(14,27,5))'
    );
  });

  it('marks zone-less model datetimes as UTC and leaves other columns alone', () => {
    const out = markUtc(
      { columns: [{ name: '[Hour]' }, { name: '[Gravity]' }], rows: [['2026-10-24T14:00:00.000', 1.07]] },
      '[Hour]'
    );
    expect(out.rows[0]).toEqual(['2026-10-24T14:00:00.000Z', 1.07]);
  });
});
