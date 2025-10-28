import { useState, useRef } from "react";
import {
  type CellContext,
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

type RowData = { id: number; [key: string]: string | number };

export function VirtualizedSelectableTable() {
  // --------------------------
  // 1. ダミーデータ生成
  // --------------------------
  const columnsCount = 100;
  const rowsCount = 1000;

  const columns: ColumnDef<RowData>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
        />
      ),
      size: 40,
    },
    ...Array.from({ length: columnsCount }, (_, i) => ({
      accessorKey: `col${i + 1}`,
      header: `Column ${i + 1}`,
      cell: (info: CellContext<RowData, string | number>) => info.getValue(),
      size: 120,
    })),
  ];

  const [data] = useState<RowData[]>(
    Array.from({ length: rowsCount }, (_, rowIndex) => {
      const row: RowData = { id: rowIndex + 1 };
      for (let col = 0; col < columnsCount; col++) {
        row[`col${col + 1}`] = `R${rowIndex + 1}C${col + 1}`;
      }
      return row;
    })
  );

  const [rowSelection, setRowSelection] = useState({});

  // --------------------------
  // 2. TanStack Table生成
  // --------------------------
  const table = useReactTable({
    data,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
  });

  // --------------------------
  // 3. Virtualizer設定
  // --------------------------
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35, // 各行の高さ
    overscan: 10,
  });

  const colVirtualizer = useVirtualizer({
    horizontal: true,
    count: table.getAllLeafColumns().length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
    overscan: 5,
  });

  // --------------------------
  // 4. 仮想テーブル描画
  // --------------------------
  return (
    <div
      ref={parentRef}
      style={{
        width: "100%",
        height: "600px",
        overflow: "auto",
        position: "relative",
      }}
    >
      <div
        style={{
          width: colVirtualizer.getTotalSize(),
          height: rowVirtualizer.getTotalSize(),
          position: "relative",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const row = table.getRowModel().rows[virtualRow.index];
          return (
            <div
              key={row.id}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                transform: `translateY(${virtualRow.start}px)`,
                height: `${virtualRow.size}px`,
                display: "flex",
              }}
            >
              {colVirtualizer.getVirtualItems().map((virtualCol) => {
                const cell = row.getVisibleCells()[virtualCol.index];
                return (
                  <div
                    key={cell.id}
                    style={{
                      width: `${virtualCol.size}px`,
                      transform: `translateX(${virtualCol.start}px)`,
                      border: "1px solid #ccc",
                      padding: "4px",
                      boxSizing: "border-box",
                      flexShrink: 0,
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
