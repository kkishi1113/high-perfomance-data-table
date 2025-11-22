import { render, screen, fireEvent } from '@testing-library/react';
import { DataGridCell } from './data-grid-cell';
import { describe, it, expect, vi } from 'vitest';
import type { Cell } from '@tanstack/react-table';
import userEvent from '@testing-library/user-event';

describe('DataGridCell', () => {
  const mockCell = {
    getValue: () => 'Test Value',
  } as unknown as Cell<any, unknown>;

  const defaultProps = {
    cell: mockCell,
    isEditing: false,
    onEditStart: vi.fn(),
    onEditFinish: vi.fn(),
    onEditCancel: vi.fn(),
  };

  it('renders cell value correctly', () => {
    render(<DataGridCell {...defaultProps} />);
    expect(screen.getByText('Test Value')).toBeInTheDocument();
  });

  it('triggers onEditStart on double click', async () => {
    const user = userEvent.setup();
    render(<DataGridCell {...defaultProps} />);
    
    const cellElement = screen.getByText('Test Value');
    await user.dblClick(cellElement);
    
    expect(defaultProps.onEditStart).toHaveBeenCalled();
  });

  it('renders input when isEditing is true', () => {
    render(<DataGridCell {...defaultProps} isEditing={true} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Value')).toBeInTheDocument();
  });

  it('calls onEditFinish with new value on Enter', async () => {
    const user = userEvent.setup();
    render(<DataGridCell {...defaultProps} isEditing={true} />);
    
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'New Value{enter}');
    
    expect(defaultProps.onEditFinish).toHaveBeenCalledWith('New Value');
  });

  it('calls onEditFinish with current value on Blur', async () => {
    const user = userEvent.setup();
    render(<DataGridCell {...defaultProps} isEditing={true} />);
    
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'Blur Value');
    fireEvent.blur(input);
    
    expect(defaultProps.onEditFinish).toHaveBeenCalledWith('Blur Value');
  });

  it('calls onEditCancel on Escape', async () => {
    const user = userEvent.setup();
    render(<DataGridCell {...defaultProps} isEditing={true} />);
    
    const input = screen.getByRole('textbox');
    await user.type(input, '{escape}');
    
    expect(defaultProps.onEditCancel).toHaveBeenCalled();
  });

  describe('Edge Cases', () => {
    it('renders empty string for null value', () => {
      const nullCell = { getValue: () => null } as unknown as Cell<any, unknown>;
      render(<DataGridCell {...defaultProps} cell={nullCell} />);
      // The cell renders the value directly. If it's empty string, getByText might fail if not using queryByText or checking content.
      // Our component uses String(value ?? "")
      const cellDiv = screen.getByTitle('');
      expect(cellDiv).toHaveTextContent('');
    });

    it('renders empty string for undefined value', () => {
      const undefinedCell = { getValue: () => undefined } as unknown as Cell<any, unknown>;
      render(<DataGridCell {...defaultProps} cell={undefinedCell} />);
      const cellDiv = screen.getByTitle('');
      expect(cellDiv).toHaveTextContent('');
    });

    it('renders number values correctly', () => {
      const numberCell = { getValue: () => 123 } as unknown as Cell<any, unknown>;
      render(<DataGridCell {...defaultProps} cell={numberCell} />);
      expect(screen.getByText('123')).toBeInTheDocument();
    });

    it('renders boolean values correctly', () => {
      const boolCell = { getValue: () => true } as unknown as Cell<any, unknown>;
      render(<DataGridCell {...defaultProps} cell={boolCell} />);
      expect(screen.getByText('true')).toBeInTheDocument();
    });
  });

  describe('Memoization', () => {
    it('re-renders when value changes', () => {
      const { rerender } = render(<DataGridCell {...defaultProps} />);
      expect(screen.getByText('Test Value')).toBeInTheDocument();

      const newCell = { getValue: () => 'New Value' } as unknown as Cell<any, unknown>;
      rerender(<DataGridCell {...defaultProps} cell={newCell} />);
      expect(screen.getByText('New Value')).toBeInTheDocument();
    });

    it('re-renders when style width changes', () => {
      const { container, rerender } = render(
        <DataGridCell {...defaultProps} style={{ width: 100 }} />
      );
      expect(container.firstChild).toHaveStyle({ width: '100px' });

      rerender(<DataGridCell {...defaultProps} style={{ width: 200 }} />);
      expect(container.firstChild).toHaveStyle({ width: '200px' });
    });
  });
});
