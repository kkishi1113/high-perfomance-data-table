import { describe, it, expect, vi } from 'vitest';
import { getCommonPinningStyles } from './get-common-pinning-style';
import type { Column } from '@tanstack/react-table';

describe('getCommonPinningStyles', () => {
  const createMockColumn = (overrides: Partial<Column<any>> = {}) => ({
    getIsPinned: vi.fn(() => false),
    getIsLastColumn: vi.fn(() => false),
    getIsFirstColumn: vi.fn(() => false),
    getStart: vi.fn(() => 0),
    getAfter: vi.fn(() => 0),
    getSize: vi.fn(() => 100),
    ...overrides,
  } as unknown as Column<any>);

  it('returns default styles for unpinned column', () => {
    const column = createMockColumn({
      getIsPinned: () => false,
    });

    const styles = getCommonPinningStyles(column);

    expect(styles).toEqual({
      boxShadow: undefined,
      left: undefined,
      right: undefined,
      opacity: 1,
      position: 'relative',
      width: 100,
      zIndex: 0,
    });
  });

  it('returns correct styles for left pinned column', () => {
    const column = createMockColumn({
      getIsPinned: () => 'left',
      getStart: () => 50,
    });

    const styles = getCommonPinningStyles(column);

    expect(styles).toEqual({
      boxShadow: undefined,
      left: '50px',
      right: undefined,
      opacity: 0.95,
      position: 'sticky',
      width: 100,
      zIndex: 1,
    });
  });

  it('returns correct styles for right pinned column', () => {
    const column = createMockColumn({
      getIsPinned: () => 'right',
      getAfter: () => 20,
    });

    const styles = getCommonPinningStyles(column);

    expect(styles).toEqual({
      boxShadow: undefined,
      left: undefined,
      right: '20px',
      opacity: 0.95,
      position: 'sticky',
      width: 100,
      zIndex: 1,
    });
  });

  it('applies box shadow for last left pinned column', () => {
    const column = createMockColumn({
      getIsPinned: () => 'left',
      getIsLastColumn: (pos) => pos === 'left',
    });

    const styles = getCommonPinningStyles(column);

    expect(styles.boxShadow).toBe('-4px 0 4px -4px gray inset');
  });

  it('applies box shadow for first right pinned column', () => {
    const column = createMockColumn({
      getIsPinned: () => 'right',
      getIsFirstColumn: (pos) => pos === 'right',
    });

    const styles = getCommonPinningStyles(column);

    expect(styles.boxShadow).toBe('4px 0 4px -4px gray inset');
  });
});
