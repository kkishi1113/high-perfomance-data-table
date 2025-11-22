import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DataGrid } from './data-grid';
import { describe, it, expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import type { ColumnDefSimple } from '../types';

// Mock Worker
class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  
  constructor() {
    setTimeout(() => {
      // Simulate worker ready or initial sort
    }, 0);
  }

  postMessage(data: any) {
    const { id, op, payload } = data;
    
    if (op === 'sort') {
      const { rows, sortBy } = payload;
      // Simple sort implementation for mock
      const sorted = [...rows].sort((a, b) => {
        for (const sort of sortBy) {
          const valA = a[sort.id];
          const valB = b[sort.id];
          if (valA < valB) return sort.desc ? 1 : -1;
          if (valA > valB) return sort.desc ? -1 : 1;
        }
        return 0;
      });
      
      // Simulate async worker response
      setTimeout(() => {
        this.onmessage?.({ data: { id, result: sorted } } as MessageEvent);
      }, 10);
    }
  }

  terminate() {}
  addEventListener(type: string, listener: any) {
    if (type === 'message') this.onmessage = listener;
  }
  removeEventListener() {}
}

(globalThis as any).Worker = MockWorker;

// Mock ResizeObserver
(globalThis as any).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock getBoundingClientRect for virtualization
Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
  configurable: true,
  value: () => ({
    width: 800,
    height: 600,
    top: 0,
    left: 0,
    bottom: 600,
    right: 800,
    x: 0,
    y: 0,
    toJSON: () => {},
  }),
});

// Mock offsetHeight/Width
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 600 });
Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 800 });

describe('DataGrid', () => {
  type TestData = { id: number; name: string };
  const columns: ColumnDefSimple<TestData>[] = [
    { id: 'id', header: 'ID', accessorKey: 'id', width: 50 },
    { id: 'name', header: 'Name', accessorKey: 'name', width: 100 },
  ];

  const data = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
    { id: 3, name: 'Charlie' },
  ];

  it('should persist edits after sorting', async () => {
    const user = userEvent.setup();
    render(<DataGrid columns={columns} data={data} />);

    // 1. Edit 'Alice' to 'Alice Edited'
    const cell = await screen.findByText('Alice');
    fireEvent.doubleClick(cell);
    
    const input = screen.getByDisplayValue('Alice');
    await user.clear(input);
    await user.type(input, 'Alice Edited{enter}');

    expect(screen.getByText('Alice Edited')).toBeInTheDocument();

    // 2. Sort by Name (descending)
    const header = screen.getByText('Name');
    await user.click(header); // Asc
    await user.click(header); // Desc
    await user.click(header); // Clear (3rd click)

    // Wait for sort to finish and check for persistence (fix verification)
    await waitFor(() => {
      expect(screen.getByText('Alice Edited')).toBeInTheDocument();
    });
    
    // Check if 'Alice' is gone (should be overwritten by edit)
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });

  it('should highlight only the selected row', async () => {
    const user = userEvent.setup();
    render(<DataGrid columns={columns} data={data} />);

    // Click first row
    const firstRowCell = await screen.findByText('Alice');
    await user.click(firstRowCell);

    // Check if first row has selected style (bg-blue-50)
    const row1 = firstRowCell.closest('div[class*="absolute left-0"]');
    expect(row1).toHaveClass('bg-blue-50');

    // Check second row is NOT selected
    const secondRowCell = screen.getByText('Bob');
    const row2 = secondRowCell.closest('div[class*="absolute left-0"]');
    expect(row2).not.toHaveClass('bg-blue-50');
  });

  it('updates rows when data prop changes', async () => {
    const { rerender } = render(<DataGrid columns={columns} data={data} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();

    const newData = [
      { id: 4, name: 'Dave' },
    ];
    rerender(<DataGrid columns={columns} data={newData} />);
    
    expect(screen.getByText('Dave')).toBeInTheDocument();
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });

  it('respects enableRowSelection prop', async () => {
    const user = userEvent.setup();
    render(<DataGrid columns={columns} data={data} enableRowSelection={false} />);
    
    const cell = await screen.findByText('Alice');
    await user.click(cell);
    
    const row = cell.closest('div[class*="absolute left-0"]');
    expect(row).not.toHaveClass('bg-blue-50');
  });

  it('sorts data correctly (mocked)', async () => {
    const user = userEvent.setup();
    render(<DataGrid columns={columns} data={data} />);
    
    const header = screen.getByText('Name');
    await user.click(header); // Asc
    
    // In our mock worker, we implemented a simple sort.
    // Let's verify the order in the DOM.
    // Since virtualization is mocked with fixed positions, we might need to rely on the order of elements in the DOM or their top position.
    
    await waitFor(() => {
      const rows = screen.getAllByText(/Alice|Bob|Charlie/);
      // Alice (A), Bob (B), Charlie (C) -> Ascending
      expect(rows[0]).toHaveTextContent('Alice');
      expect(rows[1]).toHaveTextContent('Bob');
      expect(rows[2]).toHaveTextContent('Charlie');
    });

    await user.click(header); // Desc
    
    await waitFor(() => {
      const rows = screen.getAllByText(/Alice|Bob|Charlie/);
      // Charlie (C), Bob (B), Alice (A) -> Descending
      expect(rows[0]).toHaveTextContent('Charlie');
      expect(rows[1]).toHaveTextContent('Bob');
      expect(rows[2]).toHaveTextContent('Alice');
    });
  });
});
