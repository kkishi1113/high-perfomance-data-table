import { render, screen, fireEvent } from '@testing-library/react';
import { DataGridHeader } from './data-grid-header';
import { describe, it, expect, vi } from 'vitest';
import type { Header } from '@tanstack/react-table';
import userEvent from '@testing-library/user-event';

describe('DataGridHeader', () => {
  const mockToggleSorting = vi.fn();
  const mockResizeHandler = vi.fn();

  const mockHeader = {
    id: 'test-header',
    column: {
      columnDef: {
        header: 'Test Header',
      },
      getIsSorted: () => false,
      getToggleSortingHandler: () => mockToggleSorting,
      getIsResizing: () => false,
    },
    getSize: () => 100,
    getContext: () => ({}),
    getResizeHandler: () => mockResizeHandler,
  } as unknown as Header<any, unknown>;

  it('renders header text', () => {
    render(<DataGridHeader header={mockHeader} />);
    expect(screen.getByText('Test Header')).toBeInTheDocument();
  });

  it('triggers sorting on click', async () => {
    const user = userEvent.setup();
    render(<DataGridHeader header={mockHeader} />);
    
    const headerElement = screen.getByText('Test Header');
    await user.click(headerElement);
    
    expect(mockToggleSorting).toHaveBeenCalled();
  });

  it('renders ascending sort icon', () => {
    const sortedHeader = {
      ...mockHeader,
      column: {
        ...mockHeader.column,
        getIsSorted: () => 'asc',
      },
    } as unknown as Header<any, unknown>;

    render(<DataGridHeader header={sortedHeader} />);
    // Lucide icons usually render as SVGs. We can check for class or existence.
    // Or check if ArrowUp is rendered.
    // Let's assume we can find it by class or just existence of an SVG.
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('w-3 h-3');
  });

  it('renders descending sort icon', () => {
    const sortedHeader = {
      ...mockHeader,
      column: {
        ...mockHeader.column,
        getIsSorted: () => 'desc',
      },
    } as unknown as Header<any, unknown>;

    render(<DataGridHeader header={sortedHeader} />);
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders resize handler', () => {
    render(<DataGridHeader header={mockHeader} />);
    // The resize handler has class 'cursor-col-resize'
    const resizer = document.querySelector('.cursor-col-resize');
    expect(resizer).toBeInTheDocument();
  });

  it('triggers resize handler on mouse down', () => {
    render(<DataGridHeader header={mockHeader} />);
    const resizer = document.querySelector('.cursor-col-resize');
    if (resizer) {
      fireEvent.mouseDown(resizer);
      expect(mockResizeHandler).toHaveBeenCalled();
    } else {
      throw new Error('Resizer not found');
    }
  });

  it('triggers resize handler on touch start', () => {
    render(<DataGridHeader header={mockHeader} />);
    const resizer = document.querySelector('.cursor-col-resize');
    if (resizer) {
      fireEvent.touchStart(resizer);
      expect(mockResizeHandler).toHaveBeenCalled();
    } else {
      throw new Error('Resizer not found');
    }
  });

  it('applies resizing style when resizing', () => {
    const resizingHeader = {
      ...mockHeader,
      column: {
        ...mockHeader.column,
        getIsResizing: () => true,
      },
    } as unknown as Header<any, unknown>;

    render(<DataGridHeader header={resizingHeader} />);
    const resizer = document.querySelector('.cursor-col-resize');
    expect(resizer).toHaveClass('bg-blue-500');
    expect(resizer).toHaveClass('opacity-100');
    expect(resizer).toHaveClass('w-1.5');
  });

  it('renders custom header content', () => {
    const customHeader = {
      ...mockHeader,
      column: {
        ...mockHeader.column,
        columnDef: {
          header: () => <span data-testid="custom-header">Custom</span>,
        },
      },
    } as unknown as Header<any, unknown>;

    render(<DataGridHeader header={customHeader} />);
    expect(screen.getByTestId('custom-header')).toBeInTheDocument();
  });

  it('applies correct width from header.getSize()', () => {
    const sizedHeader = {
      ...mockHeader,
      getSize: () => 250,
    } as unknown as Header<any, unknown>;

    const { container } = render(<DataGridHeader header={sizedHeader} />);
    expect(container.firstChild).toHaveStyle({ width: '250px' });
  });
});
