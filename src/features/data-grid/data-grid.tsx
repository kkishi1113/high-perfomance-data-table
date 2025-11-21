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
import { DataGridBody } from "./data-grid-body";
import { DataGridHeader } from "./data-grid-header";
import { cn } from "@/lib/utils";
import type { DataGridProps, WorkerResponse } from "./types";

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
  const rowsRef = useRef(rows);

  useEffect(() => {
    rowsRef.current = rows;
  });

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
      // If no sort, we might want to reset to original data order if we had a way to know it.
      // For now, if data prop changes, it resets.
      // If we just cleared sort, we might want to re-apply data to rows to reset order.
      // But only if rows are currently different from data (which they might be if sorted).
      // A simple check:
      if (data !== rows) {
        // When clearing sort, we want to return to the original order (data),
        // but preserve any edits made to the rows (rowsRef.current).
        // We assume rows have a unique 'id' property to match them.
        const currentRowsMap = new Map(rowsRef.current.map((r: any) => [r.id, r]));
        
        const mergedRows = data.map((originalRow: any) => {
          // If the row exists in current state (potentially edited), use it.
          // Otherwise fallback to original.
          // Note: This relies on 'id' being present and stable.
          if (originalRow.id !== undefined && currentRowsMap.has(originalRow.id)) {
            return currentRowsMap.get(originalRow.id)!;
          }
          return originalRow;
        });

        setRows(mergedRows);
      }
      return;
    }

    const runSort = async () => {
      // Optimization: Don't sort if data hasn't changed and sorting hasn't changed.
      // But here we are in useEffect [sorting, data], so it's fine.
      
      // Use rowsRef.current to preserve edits when sorting
      // But if data prop changed recently, we should use that.
      // However, setRows(data) effect handles data prop changes.
      // So here we just sort whatever is current.
      const sorted = await postWorker("sort", {
        rows: rowsRef.current, 
        sortBy: sorting,
      });
      if (sorted) setRows(sorted);
    };
    runSort();
  }, [sorting, postWorker]); // Removed data from dependency to avoid conflict/race, handled by setRows(data) effect

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
    enableColumnResizing, // Ensure this is passed to table options
  });

  // --- Virtualization ---
  const parentRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null); // Ref for header to sync scroll

  const { rows: tableRows } = table.getRowModel();
  const visibleColumns = table.getVisibleLeafColumns();
  const { columnSizing } = table.getState();

  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: visibleColumns.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => visibleColumns[i].getSize(),
    overscan: 2,
    lanes: columnSizing ? undefined : undefined, // Hack to force update? No, let's rely on re-render.
  });

  // Force update virtualizer when column sizing changes
  useEffect(() => {
    columnVirtualizer.measure();
  }, [columnSizing, columnVirtualizer]);

  // --- Scroll Sync ---
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (headerRef.current) {
      headerRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  }, []);

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
        ref={headerRef}
        className="flex border-b bg-gray-50 sticky top-0 z-10 overflow-hidden" // overflow-hidden to hide scrollbar but allow programmatic scroll
        style={{
          width: "100%", // Match container width
          height: headerHeight,
        }}
      >
        <div
          style={{
            width: columnVirtualizer.getTotalSize(),
            height: "100%",
            position: "relative",
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
      </div>

      {/* Body */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto"
        onScroll={handleScroll} // Sync scroll
        style={{
          height: "100%",
        }}
      >
        <DataGridBody
          virtualRows={rowVirtualizer.getVirtualItems()}
          virtualCols={columnVirtualizer.getVirtualItems()}
          totalHeight={rowVirtualizer.getTotalSize()}
          totalWidth={columnVirtualizer.getTotalSize()}
          rows={tableRows}
          editingCell={editingCell}
          onEditStart={useCallback((rowIndex, colId) => setEditingCell({ rowIndex, colId }), [])}
          onEditFinish={handleEditFinish}
          onEditCancel={useCallback(() => setEditingCell(null), [])}
          selectedRowIds={rowSelection}
        />
      </div>
    </div>
  );
}
