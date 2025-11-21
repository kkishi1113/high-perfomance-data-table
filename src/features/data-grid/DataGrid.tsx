import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { createWorker } from "./worker-factory";
import { DataGridHeader } from "./DataGridHeader";
import { DataGridBody } from "./DataGridBody";
import type { DataGridProps, WorkerResponse } from "./types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function DataGrid<T extends Record<string, any>>({
  columns,
  data,
  rowHeight = 34,
  headerHeight = 40,
  estimatedColumnWidth = 120,
  className,
  style,
  onDataChange,
  enableRowSelection = true,
  enableColumnResizing = true,
  enableSorting = true,
}: DataGridProps<T>) {
  // --- State ---
  const [rows, setRows] = useState<T[]>(() => data);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // --- Worker ---
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    setRows(data);
  }, [data]);

  useEffect(() => {
    workerRef.current = createWorker();
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const postWorker = useCallback((op: string, payload: any) => {
    return new Promise<any>((resolve, reject) => {
      const id = ++requestIdRef.current;
      const w = workerRef.current;
      if (!w) return resolve(null);

      const handler = (e: MessageEvent<WorkerResponse>) => {
        if (e.data.id !== id) return;
        w.removeEventListener("message", handler);
        if ("error" in e.data) {
          reject(new Error(e.data.error));
        } else {
          resolve(e.data.result);
        }
      };
      w.addEventListener("message", handler);
      w.postMessage({ id, op, payload });
    });
  }, []);

  // --- Sorting Effect (Worker) ---
  useEffect(() => {
    if (sorting.length === 0) {
      // Reset to original order if needed, or just keep current if no sort
      // For now, let's assume we just sort the current 'rows' state
      // But ideally we should sort the *original* data.
      // Simplified: if no sort, maybe reset to 'data' prop?
      if (data !== rows) setRows(data);
      return;
    }

    const runSort = async () => {
      const sorted = await postWorker("sort", {
        rows: data, // Always sort from source of truth
        sortBy: sorting,
      });
      if (sorted) setRows(sorted);
    };
    runSort();
  }, [sorting, data, postWorker]);

  // --- Table Definition ---
  const tableColumns = useMemo<ColumnDef<T>[]>(
    () =>
      columns.map((col) => ({
        accessorKey: col.accessorKey,
        header: col.header,
        size: col.width ?? estimatedColumnWidth,
        minSize: col.minWidth ?? 50,
        maxSize: col.maxWidth ?? 500,
        enableResizing: col.enableResizing ?? enableColumnResizing,
        enableSorting: col.enableSorting ?? enableSorting,
        cell: (info) => info.getValue(),
      })),
    [columns, estimatedColumnWidth, enableColumnResizing, enableSorting]
  );

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    state: {
      sorting,
      rowSelection,
      columnFilters,
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
    enableRowSelection,
  });

  // --- Virtualization ---
  const parentRef = useRef<HTMLDivElement>(null);

  const { rows: tableRows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: tableColumns.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => table.getAllColumns()[i].getSize(), // Use table column size which updates on resize
    overscan: 2,
  });

  // --- Editing ---
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    colId: string;
  } | null>(null);

  const handleEditFinish = useCallback(
    (rowIndex: number, colId: string, value: any) => {
      setRows((prev) => {
        const next = [...prev];
        const row = next[rowIndex];
        // This assumes simple object structure. Deep nesting needs more logic.
        // Also we need to find the key from colId if possible, or use accessorKey
        // For now, assuming colId matches key or accessorKey
        const colDef = columns.find((c) => c.id === colId || c.accessorKey === colId);
        const key = colDef?.accessorKey || colId;
        
        next[rowIndex] = { ...row, [key]: value };
        onDataChange?.(next);
        return next;
      });
      setEditingCell(null);
    },
    [columns, onDataChange]
  );

  // --- Render ---
  return (
    <div
      className={cn("flex flex-col border rounded-md overflow-hidden bg-white", className)}
      style={style}
    >
      {/* Header */}
      <div
        className="flex border-b bg-gray-50 sticky top-0 z-10"
        style={{
          width: columnVirtualizer.getTotalSize(),
          height: headerHeight,
        }}
      >
        {columnVirtualizer.getVirtualItems().map((virtualCol) => {
          const header = table.getFlatHeaders()[virtualCol.index];
          return (
            <DataGridHeader
              key={header.id}
              header={header}
              style={{
                width: virtualCol.size,
                transform: `translateX(${virtualCol.start}px)`,
                position: "absolute",
                left: 0,
              }}
            />
          );
        })}
      </div>

      {/* Body */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto"
        style={{
          height: "100%", // Fill remaining space
        }}
      >
        <DataGridBody

          rowVirtualizer={rowVirtualizer}
          columnVirtualizer={columnVirtualizer}
          rows={tableRows}
          editingCell={editingCell}
          onEditStart={(rowIndex, colId) => setEditingCell({ rowIndex, colId })}
          onEditFinish={handleEditFinish}
          onEditCancel={() => setEditingCell(null)}
        />
      </div>
    </div>
  );
}
