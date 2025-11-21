import { render, screen } from '@testing-library/react';
import { DataGridBody } from './DataGridBody';
import { describe, it, expect, vi } from 'vitest';
import type { Row } from '@tanstack/react-table';
import type { VirtualItem } from '@tanstack/react-virtual';
import userEvent from '@testing-library/user-event';

describe('DataGridBody', () => {
  const mockToggleSelected = vi.fn();
  const mockOnEditStart = vi.fn();
  const mockOnEditFinish = vi.fn();
  const mockOnEditCancel = vi.fn();

  const mockRows = [
    {
      id: 'row-1',
      index: 0,
      getVisibleCells: () => [
        {
          id: 'cell-1-1',
          column: { id: 'col-1' },
          getValue: () => 'Value 1',
        },
        {
          id: 'cell-1-2',
          column: { id: 'col-2' },
          getValue: () => 'Value 2',
        },
      ],
      getIsSelected: () => false,
      toggleSelected: mockToggleSelected,
    },
    {
      id: 'row-2',
      index: 1,
      getVisibleCells: () => [
        {
          id: 'cell-2-1',
          column: { id: 'col-1' },
          getValue: () => 'Value 3',
        },
        {
          id: 'cell-2-2',
          column: { id: 'col-2' },
          getValue: () => 'Value 4',
        },
      ],
      getIsSelected: () => true,
      toggleSelected: mockToggleSelected,
    },
  ] as unknown as Row<any>[];

  const mockVirtualRows = [
    { index: 0, start: 0, size: 30 },
    { index: 1, start: 30, size: 30 },
  ] as VirtualItem[];

  const mockVirtualCols = [
    { index: 0, start: 0, size: 100 },
    { index: 1, start: 100, size: 100 },
  ] as VirtualItem[];

  const defaultProps = {
    virtualRows: mockVirtualRows,
    virtualCols: mockVirtualCols,
    totalHeight: 60,
    totalWidth: 200,
    rows: mockRows,
    editingCell: null,
    onEditStart: mockOnEditStart,
    onEditFinish: mockOnEditFinish,
    onEditCancel: mockOnEditCancel,
    selectedRowIds: {},
  };

  it('renders correct number of rows and cells', () => {
    render(<DataGridBody {...defaultProps} />);
    
    expect(screen.getByText('Value 1')).toBeInTheDocument();
    expect(screen.getByText('Value 2')).toBeInTheDocument();
    expect(screen.getByText('Value 3')).toBeInTheDocument();
    expect(screen.getByText('Value 4')).toBeInTheDocument();
  });

  it('applies selection styles correctly', () => {
    render(<DataGridBody {...defaultProps} />);
    
    const row1Cell = screen.getByText('Value 1');
    const row1 = row1Cell.closest('div[class*="absolute left-0"]');
    expect(row1).not.toHaveClass('bg-blue-50');

    const row2Cell = screen.getByText('Value 3');
    const row2 = row2Cell.closest('div[class*="absolute left-0"]');
    expect(row2).toHaveClass('bg-blue-50');
  });

  it('triggers row selection on click', async () => {
    const user = userEvent.setup();
    render(<DataGridBody {...defaultProps} />);
    
    const row1Cell = screen.getByText('Value 1');
    const row1 = row1Cell.closest('div[class*="absolute left-0"]');
    if (row1) {
      await user.click(row1);
      expect(mockToggleSelected).toHaveBeenCalled();
    } else {
      throw new Error('Row 1 not found');
    }
  });

  it('passes isEditing prop correctly', () => {
    render(
      <DataGridBody
        {...defaultProps}
        editingCell={{ rowIndex: 0, colId: 'col-1' }}
      />
    );
    
    // The cell should render an input (textbox)
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Value 1')).toBeInTheDocument();
  });

  it('renders correct virtualization styles', () => {
    render(<DataGridBody {...defaultProps} />);
    
    // Row 1
    const row1Cell = screen.getByText('Value 1');
    const row1 = row1Cell.closest('div[class*="absolute left-0"]');
    expect(row1).toHaveStyle({
      top: '0px',
      height: '30px',
      width: '200px',
    });

    // Cell 1-1
    const cell1 = row1Cell.closest('div[class*="absolute top-0"]');
    expect(cell1).toHaveStyle({
      left: '0px',
      width: '100px',
    });
  });

  it('handles empty rows gracefully', () => {
    render(<DataGridBody {...defaultProps} rows={[]} virtualRows={[]} />);
    // Should render container with correct dimensions but no rows
    // We can check that no text from mock rows is present
    expect(screen.queryByText('Value 1')).not.toBeInTheDocument();
  });

  it('passes correct arguments to onEditStart', async () => {
    const user = userEvent.setup();
    render(<DataGridBody {...defaultProps} />);
    
    const cell = screen.getByText('Value 1');
    await user.dblClick(cell);
    
    expect(mockOnEditStart).toHaveBeenCalledWith(0, 'col-1');
  });

  it('passes correct arguments to onEditFinish', async () => {
    const user = userEvent.setup();
    render(
      <DataGridBody
        {...defaultProps}
        editingCell={{ rowIndex: 0, colId: 'col-1' }}
      />
    );
    
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'New Val{enter}');
    
    expect(mockOnEditFinish).toHaveBeenCalledWith(0, 'col-1', 'New Val');
  });
});
