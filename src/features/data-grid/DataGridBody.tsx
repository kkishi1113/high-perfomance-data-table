
import type { Row } from "@tanstack/react-table";
import { Virtualizer } from "@tanstack/react-virtual";
import { DataGridCell } from "./DataGridCell";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type DataGridBodyProps<T> = {

  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  columnVirtualizer: Virtualizer<HTMLDivElement, Element>;
  rows: Row<T>[];
  editingCell: { rowIndex: number; colId: string } | null;
  onEditStart: (rowIndex: number, colId: string) => void;
  onEditFinish: (rowIndex: number, colId: string, value: any) => void;
  onEditCancel: () => void;
};

export function DataGridBody<T>({

  rowVirtualizer,
  columnVirtualizer,
  rows,
  editingCell,
  onEditStart,
  onEditFinish,
  onEditCancel,
}: DataGridBodyProps<T>) {
  const { getVirtualItems: getVirtualRows, getTotalSize: getTotalRowHeight } =
    rowVirtualizer;
  const { getVirtualItems: getVirtualCols, getTotalSize: getTotalColWidth } =
    columnVirtualizer;

  const virtualRows = getVirtualRows();
  const virtualCols = getVirtualCols();

  return (
    <div
      className="relative w-full"
      style={{
        height: getTotalRowHeight(),
        width: getTotalColWidth(),
      }}
    >
      {virtualRows.map((virtualRow) => {
        const row = rows[virtualRow.index];
        if (!row) return null;
        const visibleCells = row.getVisibleCells();

        return (
          <div
            key={row.id}
            className={cn(
              "absolute left-0 flex items-center border-b hover:bg-gray-50 transition-colors",
              row.getIsSelected() && "bg-blue-50 hover:bg-blue-100"
            )}
            style={{
              top: virtualRow.start,
              height: virtualRow.size,
              width: getTotalColWidth(),
            }}
            onClick={() => row.toggleSelected()}
          >
            {virtualCols.map((virtualCol) => {
              const cell = visibleCells[virtualCol.index];
              if (!cell) return null;

              const isEditing =
                editingCell?.rowIndex === virtualRow.index &&
                editingCell?.colId === cell.column.id;

              return (
                <div
                  key={cell.id}
                  className="absolute top-0 h-full border-r last:border-r-0"
                  style={{
                    left: virtualCol.start,
                    width: virtualCol.size,
                  }}
                >
                  <DataGridCell
                    cell={cell}
                    isEditing={isEditing}
                    onEditStart={() =>
                      onEditStart(virtualRow.index, cell.column.id)
                    }
                    onEditFinish={(val) =>
                      onEditFinish(virtualRow.index, cell.column.id, val)
                    }
                    onEditCancel={onEditCancel}
                  />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
