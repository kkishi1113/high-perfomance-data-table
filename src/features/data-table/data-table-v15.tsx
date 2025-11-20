import React, {
  useMemo,
  useRef,
  useState,
  useEffect,
  useTransition,
  type CSSProperties,
  type HTMLProps,
  type ReactNode,
} from "react";
import {
  useQuery,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type ColumnDef,
  flexRender,
  type Cell,
  type Table as TanStackTable,
  type Row,
  type SortingState,
  type ColumnFiltersState,
  type RowSelectionState,
  type RowPinningState,
  type Header,
  type Column,
} from "@tanstack/react-table";
import {
  useVirtualizer,
  Virtualizer,
  type VirtualItem,
  elementScroll, // 追加
} from "@tanstack/react-virtual";

/**
 * ============================================================================
 * LAYER 1: DOMAIN & INTERFACES
 * ============================================================================
 */

export type MatrixRow = string[];
export type MatrixData = MatrixRow[];

export interface GridFeatureConfig {
  defaultColumnSize?: number;
  pinnedRowIds?: string[];
  pinnedColIds?: string[];
  aggregationColIds?: string[];
  enableRowSelection?: boolean;
  enableColumnResizing?: boolean;
  enableSorting?: boolean;
  enableFiltering?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meta?: Record<string, any>;
  getCellStyle?: (params: {
    rowId: string;
    colId: string;
    value: string;
    isPinned: boolean;
  }) => CSSProperties;
}

export interface GridUIProps {
  isLoading: boolean;
  isSorting: boolean;
  table: TanStackTable<MatrixRow>;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  columnVirtualizer: Virtualizer<HTMLDivElement, Element>;
  parentRef: React.RefObject<HTMLDivElement | null>;
  featureConfig: GridFeatureConfig;
  virtualColumns: VirtualItem[];
  pinnedRows: Row<MatrixRow>[];
  scrollableRows: Row<MatrixRow>[];
  aggregatedData: Record<string, number | string>;
  totalWidth: number;
  totalHeight: number;
  headerHeight: number; // 追加
}

/**
 * ============================================================================
 * LAYER 2: PURE LOGIC
 * ============================================================================
 */

function DebouncedInput({
  value: initialValue,
  onChange,
  debounce = 500,
  ...props
}: {
  value: string | number;
  onChange: (value: string | number) => void;
  debounce?: number;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange">) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      onChange(value);
    }, debounce);
    return () => clearTimeout(timeout);
  }, [value, debounce, onChange]);

  return (
    <input
      {...props}
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}

function IndeterminateCheckbox({
  indeterminate,
  className = "",
  ...rest
}: { indeterminate?: boolean } & HTMLProps<HTMLInputElement>) {
  const ref = useRef<HTMLInputElement>(null!);
  useEffect(() => {
    if (typeof indeterminate === "boolean") {
      ref.current.indeterminate = !rest.checked && indeterminate;
    }
  }, [ref, indeterminate, rest.checked]);
  return (
    <input
      type="checkbox"
      ref={ref}
      className={className + " cursor-pointer"}
      {...rest}
    />
  );
}

const Logic = {
  createMockData: (rows: number, cols: number): MatrixData => {
    const matrix: MatrixData = [];
    for (let i = 0; i < rows; i++) {
      const row = new Array(cols);
      row[0] = String(i);
      row[1] = `User ${i}`;
      row[2] = i % 3 === 0 ? "Active" : "Inactive";
      row[3] = String(Math.floor(Math.random() * 10000));
      for (let j = 4; j < cols; j++)
        row[j] = `${Math.floor(Math.random() * 100)}`;
      matrix.push(row);
    }
    return matrix;
  },

  generateColumns: (
    colCount: number,
    featureConfig: GridFeatureConfig
  ): ColumnDef<MatrixRow>[] => {
    const columns: ColumnDef<MatrixRow>[] = [];
    if (featureConfig.enableRowSelection) {
      columns.push({
        id: "select",
        header: ({ table }) => (
          <div className="px-1 flex justify-center">
            <IndeterminateCheckbox
              {...{
                checked: table.getIsAllRowsSelected(),
                indeterminate: table.getIsSomeRowsSelected(),
                onChange: table.getToggleAllRowsSelectedHandler(),
              }}
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="px-1 flex justify-center">
            <IndeterminateCheckbox
              {...{
                checked: row.getIsSelected(),
                disabled: !row.getCanSelect(),
                indeterminate: row.getIsSomeSelected(),
                onChange: row.getToggleSelectedHandler(),
              }}
            />
          </div>
        ),
        size: 50,
        enableSorting: false,
        enableResizing: false,
        enableColumnFilter: false,
      });
    }
    for (let i = 0; i < colCount; i++) {
      columns.push({
        id: String(i),
        header:
          i === 0 ? "ID" : i === 1 ? "Name" : i === 2 ? "Status" : `Col ${i}`,
        accessorFn: (row) => row[i],
        size: featureConfig.defaultColumnSize ?? 100,
      });
    }
    return columns;
  },

  calculateAggregation: (
    data: MatrixData,
    colIds: string[] = []
  ): Record<string, number> => {
    if (colIds.length === 0) return {};
    const result: Record<string, number> = {};
    colIds.forEach((id) => (result[id] = 0));
    for (const row of data) {
      for (const colId of colIds) {
        const colIdx = parseInt(colId, 10);
        const val = parseFloat(row[colIdx] || "0");
        if (!isNaN(val)) result[colId] += val;
      }
    }
    return result;
  },

  getPinningStyle: (
    column: Column<MatrixRow> | Header<MatrixRow, unknown>,
    pinnedColIds: string[] = []
  ): CSSProperties => {
    const isPinned = pinnedColIds.includes(column.id);
    if (!isPinned) return {};
    return {
      position: "sticky",
      left: `${column.getStart("left")}px`,
      zIndex: 10,
      opacity: 1,
    };
  },
};

/**
 * ============================================================================
 * LAYER 3: DATA & STATE LOGIC (Controller)
 * ============================================================================
 */

const useGridData = () => {
  return useQuery({
    queryKey: ["gridData"],
    queryFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const data = Logic.createMockData(100000, 100);
      return Object.freeze(data);
    },
    structuralSharing: false,
    staleTime: Infinity,
  });
};

const useGridController = (featureConfig: GridFeatureConfig): GridUIProps => {
  const { data, isLoading } = useGridData();
  const parentRef = useRef<HTMLDivElement>(null);
  const [isSorting, startTransition] = useTransition();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [rowPinning, setRowPinning] = useState<RowPinningState>({
    top: featureConfig.pinnedRowIds ?? [],
    bottom: [],
  });

  const columns = useMemo(() => {
    if (!data || data.length === 0) return [];
    return Logic.generateColumns(data[0].length, featureConfig);
  }, [data, featureConfig]);

  const table = useReactTable({
    data: (data as MatrixData) ?? [],
    columns,
    state: {
      sorting,
      columnFilters,
      rowSelection,
      rowPinning,
      columnPinning: { left: featureConfig.pinnedColIds },
    },
    onSortingChange: (updater) => startTransition(() => setSorting(updater)),
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onRowPinningChange: setRowPinning,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: featureConfig.enableRowSelection,
    enableColumnResizing: featureConfig.enableColumnResizing,
    enableRowPinning: true,
    columnResizeMode: "onChange",
    meta: featureConfig.meta,
    getRowId: (row) => row[0],
  });

  const aggregatedData = useMemo(() => {
    if (!data) return {};
    return Logic.calculateAggregation(
      data as MatrixData,
      featureConfig.aggregationColIds
    );
  }, [data, featureConfig.aggregationColIds]);

  // 行の分離
  const { rows } = table.getRowModel();
  const pinnedRowIds = new Set(rowPinning.top ?? []);

  // メモ化して再計算コストを下げる
  const { pinnedRows, scrollableRows } = useMemo(() => {
    const pinned: Row<MatrixRow>[] = [];
    const scrollable: Row<MatrixRow>[] = [];
    rows.forEach((row) => {
      if (pinnedRowIds.has(row.id)) pinned.push(row);
      else scrollable.push(row);
    });
    return { pinnedRows: pinned, scrollableRows: scrollable };
  }, [rows, pinnedRowIds]);

  // Virtualization
  const rowVirtualizer = useVirtualizer({
    count: scrollableRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 5,
    scrollToFn: elementScroll, // ブラウザ標準のスクロール関数を使用
  });

  const visibleColumns = table.getVisibleLeafColumns();
  const columnVirtualizer = useVirtualizer({
    count: visibleColumns.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => visibleColumns[index].getSize(),
    horizontal: true,
    overscan: 5,
  });

  // 【修正】固定列マージロジック（パフォーマンス対策済み）
  const rawVirtualColumns = columnVirtualizer.getVirtualItems();

  const virtualColumns = useMemo(() => {
    const pinnedColIds = featureConfig.pinnedColIds ?? [];
    if (pinnedColIds.length === 0) return rawVirtualColumns;

    // 表示されている仮想列のインデックスセット
    const virtualIndices = new Set(rawVirtualColumns.map((vc) => vc.index));

    // 仮想化リストに含まれていない固定列を探す
    const missingPinnedCols = visibleColumns
      .map((col, index) => ({ col, index }))
      .filter(
        (item) =>
          pinnedColIds.includes(item.col.id) && !virtualIndices.has(item.index)
      )
      .map(
        ({ index }) =>
          ({
            index,
            start: columnVirtualizer.getOffsetForIndex(index),
            size: columnVirtualizer.getSize(index),
            key: `pinned-col-${index}`,
            measureElement: () => {}, // Dummy
          } as VirtualItem)
      );

    if (missingPinnedCols.length === 0) return rawVirtualColumns;

    // マージしてソート
    return [...missingPinnedCols, ...rawVirtualColumns].sort(
      (a, b) => a.index - b.index
    );
  }, [
    rawVirtualColumns,
    visibleColumns,
    featureConfig.pinnedColIds,
    columnVirtualizer,
  ]);

  // ヘッダー高さと固定行高さの計算（スクロールパディング用）
  const HEADER_HEIGHT = 60;
  const ROW_HEIGHT = 35;
  const headerHeight =
    HEADER_HEIGHT +
    (Object.keys(aggregatedData).length > 0 ? ROW_HEIGHT : 0) +
    pinnedRows.length * ROW_HEIGHT;

  // Measure columns on resize
  const { columnSizing } = table.getState();
  useEffect(() => {
    columnVirtualizer.measure();
  }, [columnSizing, columnVirtualizer]);

  return {
    isLoading,
    isSorting,
    table,
    rowVirtualizer,
    columnVirtualizer,
    parentRef,
    featureConfig,
    virtualColumns,
    pinnedRows,
    scrollableRows,
    aggregatedData,
    totalWidth: columnVirtualizer.getTotalSize(),
    totalHeight: rowVirtualizer.getTotalSize(),
    headerHeight,
  };
};

/**
 * ============================================================================
 * LAYER 4: UI COMPONENTS
 * ============================================================================
 */

const CellContent = React.memo(
  ({
    cell,
    featureConfig,
  }: {
    cell: Cell<MatrixRow, unknown>;
    featureConfig: GridFeatureConfig;
  }) => {
    const colId = cell.column.id;
    const rowId = cell.row.id;
    const value = cell.getValue() as string;
    const isPinned = featureConfig.pinnedColIds?.includes(colId) ?? false;

    const customStyle = featureConfig.getCellStyle?.({
      rowId,
      colId,
      value,
      isPinned,
    });
    const pinningStyle = Logic.getPinningStyle(
      cell.column,
      featureConfig.pinnedColIds
    );

    return (
      <div
        className="flex items-center px-2 text-sm truncate border-r h-full bg-inherit box-border"
        style={{
          width: `${cell.column.getSize()}px`,
          ...pinningStyle,
          ...customStyle,
        }}
      >
        {flexRender(cell.column.columnDef.cell, cell.getContext())}
      </div>
    );
  }
);

const ColumnResizer = ({ header }: { header: Header<MatrixRow, unknown> }) => {
  if (!header.column.getCanResize()) return null;
  return (
    <div
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
      onClick={(e) => e.stopPropagation()}
      className={`absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none bg-gray-300 opacity-0 hover:opacity-100 group-hover:opacity-100 ${
        header.column.getIsResizing() ? "bg-blue-500 opacity-100" : ""
      }`}
    />
  );
};

// --- Blocks ---

const TableHeader = ({
  table,
  virtualColumns,
  featureConfig,
  totalWidth,
}: {
  table: TanStackTable<MatrixRow>;
  virtualColumns: VirtualItem[];
  featureConfig: GridFeatureConfig;
  totalWidth: number;
}) => {
  const visibleHeaders = table.getFlatHeaders();

  return (
    <div
      className="sticky top-0 z-30 bg-gray-100 border-b text-gray-600 font-medium shadow-sm"
      style={{
        width: `${totalWidth}px`,
        height: "60px",
        minWidth: "100%", // コンテナより小さい場合でも背景を伸ばす
      }}
    >
      {virtualColumns.map((vc) => {
        const header = visibleHeaders[vc.index];
        const pinningStyle = Logic.getPinningStyle(
          header,
          featureConfig.pinnedColIds
        );

        return (
          <div
            key={header.id}
            className="absolute top-0 flex flex-col justify-between px-2 py-1 border-r text-xs uppercase tracking-wider bg-gray-100 box-border group"
            style={{
              left: `${vc.start}px`,
              width: `${header.getSize()}px`,
              height: "100%",
              ...pinningStyle,
            }}
          >
            <div
              className={`flex items-center w-full cursor-pointer select-none ${
                header.column.getCanSort() ? "hover:text-gray-900" : ""
              }`}
              onClick={header.column.getToggleSortingHandler()}
            >
              {flexRender(header.column.columnDef.header, header.getContext())}
              {{
                asc: " 🔼",
                desc: " 🔽",
              }[header.column.getIsSorted() as string] ?? null}
            </div>
            {header.column.getCanFilter() ? (
              <DebouncedInput
                type="text"
                value={(header.column.getFilterValue() ?? "") as string}
                onChange={(value) => header.column.setFilterValue(value)}
                placeholder="Filter"
                className="w-full mt-1 px-1 py-0.5 border rounded text-[10px] font-normal"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div className="h-[20px]" />
            )}
            <ColumnResizer header={header} />
          </div>
        );
      })}
    </div>
  );
};

const AggregateRows = ({
  aggregatedData,
  virtualColumns,
  visibleColumns,
  featureConfig,
  totalWidth,
}: {
  aggregatedData: Record<string, string | number>;
  virtualColumns: VirtualItem[];
  visibleColumns: Column<MatrixRow>[];
  featureConfig: GridFeatureConfig;
  totalWidth: number;
}) => {
  if (Object.keys(aggregatedData).length === 0) return null;

  return (
    <div
      className="relative h-[35px] bg-blue-50 border-b border-blue-200 font-bold text-blue-900"
      style={{ width: `${totalWidth}px` }}
    >
      {virtualColumns.map((vc) => {
        const col = visibleColumns[vc.index];
        const pinningStyle = Logic.getPinningStyle(
          col,
          featureConfig.pinnedColIds
        );
        const val = aggregatedData[col.id];

        return (
          <div
            key={vc.key}
            className="absolute top-0 h-full flex items-center justify-end px-2 border-r text-sm bg-blue-50 box-border"
            style={{
              left: `${vc.start}px`,
              width: `${col.getSize()}px`,
              ...pinningStyle,
            }}
          >
            {val !== undefined ? `Sum: ${val.toLocaleString()}` : ""}
          </div>
        );
      })}
    </div>
  );
};

const PinnedRows = ({
  rows,
  virtualColumns,
  featureConfig,
  totalWidth,
}: {
  rows: Row<MatrixRow>[];
  virtualColumns: VirtualItem[];
  featureConfig: GridFeatureConfig;
  totalWidth: number;
}) => {
  if (rows.length === 0) return null;

  return (
    <>
      {rows.map((row) => (
        <div
          key={row.id}
          className="relative h-[35px] bg-yellow-50 border-b border-yellow-200"
          style={{ width: `${totalWidth}px` }}
        >
          {virtualColumns.map((vc) => {
            const cell = row.getVisibleCells()[vc.index];
            return (
              <div
                key={cell.id}
                className="absolute top-0 h-full"
                style={{ left: `${vc.start}px` }}
              >
                <CellContent cell={cell} featureConfig={featureConfig} />
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
};

// --- Layout ---

const Table = ({
  children,
  totalWidth,
  totalHeight,
  headerHeight,
}: {
  children: ReactNode;
  totalWidth: number;
  totalHeight: number;
  headerHeight: number;
}) => (
  <div
    style={{
      position: "relative",
      width: `${totalWidth}px`,
      height: `${totalHeight + headerHeight}px`, // ヘッダー分高くする
    }}
  >
    {children}
  </div>
);

const TableBody = ({
  pinnedRows,
  scrollableRows,
  aggregatedData,
  rowVirtualizer,
  virtualColumns,
  visibleColumns,
  featureConfig,
  totalWidth,
  headerHeight,
}: {
  pinnedRows: Row<MatrixRow>[];
  scrollableRows: Row<MatrixRow>[];
  aggregatedData: Record<string, string | number>;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  virtualColumns: VirtualItem[];
  visibleColumns: Column<MatrixRow>[];
  featureConfig: GridFeatureConfig;
  totalWidth: number;
  headerHeight: number;
}) => {
  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <>
      {/* 1. Sticky Area (Header + Aggregation + Pinned Rows) 
          これはスクロールコンテナ内の上部に張り付く
        */}
      <div
        className="sticky top-0 z-20 bg-white"
        style={{
          width: `${totalWidth}px`,
          height: `${headerHeight}px`,
        }}
      >
        <AggregateRows
          aggregatedData={aggregatedData}
          virtualColumns={virtualColumns}
          visibleColumns={visibleColumns}
          featureConfig={featureConfig}
          totalWidth={totalWidth}
        />
        <PinnedRows
          rows={pinnedRows}
          virtualColumns={virtualColumns}
          featureConfig={featureConfig}
          totalWidth={totalWidth}
        />
      </div>

      {/* 2. Virtual Scrollable Area 
          ヘッダーの高さ分だけ絶対配置で下にずらすのではなく、
          コンテナのpaddingTopで確保しているため、start位置をそのまま使える
        */}
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%" }}>
        {virtualRows.map((virtualRow) => {
          const row = scrollableRows[virtualRow.index];
          return (
            <div
              key={row.id}
              className={`absolute left-0 w-full flex border-b transition-colors box-border ${
                row.getIsSelected() ? "bg-blue-50" : "bg-white hover:bg-gray-50"
              }`}
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start + headerHeight}px)`, // 【重要】ヘッダー高さ分ずらす
                width: `${totalWidth}px`,
              }}
            >
              {virtualColumns.map((vc) => {
                const cell = row.getVisibleCells()[vc.index];
                return (
                  <div
                    key={cell.id}
                    className="absolute top-0 h-full"
                    style={{ left: `${vc.start}px` }}
                  >
                    <CellContent cell={cell} featureConfig={featureConfig} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
};

const GridComponent = (props: GridUIProps) => {
  const {
    isLoading,
    isSorting,
    table,
    rowVirtualizer,
    parentRef,
    featureConfig,
    virtualColumns,
    pinnedRows,
    scrollableRows,
    aggregatedData,
    totalWidth,
    totalHeight,
    headerHeight,
  } = props;

  if (isLoading) return <div className="p-10 text-center">Loading...</div>;
  const visibleColumns = table.getVisibleLeafColumns();

  return (
    <div className="border rounded-md overflow-hidden flex flex-col h-[600px] w-full bg-white relative shadow-lg">
      <div className="p-2 bg-gray-50 border-b flex items-center justify-between h-[50px] shrink-0 z-40 relative">
        <span className="text-sm font-bold flex items-center gap-2">
          {isSorting ? (
            <span className="text-orange-500">Sorting...</span>
          ) : (
            "Grid Ready"
          )}
        </span>
        <button
          className="text-xs border px-2 py-1 bg-white rounded hover:bg-gray-100"
          onClick={() => table.resetRowSelection()}
        >
          Clear Selection
        </button>
      </div>

      <div
        ref={parentRef}
        className="overflow-auto w-full h-full relative"
        style={{ willChange: "transform" }} // パフォーマンス最適化
      >
        <Table
          totalWidth={totalWidth}
          totalHeight={totalHeight}
          headerHeight={headerHeight} // Tableの高さ計算に必要
        >
          <TableHeader
            table={table}
            virtualColumns={virtualColumns}
            featureConfig={featureConfig}
            totalWidth={totalWidth}
          />
          <TableBody
            pinnedRows={pinnedRows}
            scrollableRows={scrollableRows}
            aggregatedData={aggregatedData}
            rowVirtualizer={rowVirtualizer}
            virtualColumns={virtualColumns}
            visibleColumns={visibleColumns}
            featureConfig={featureConfig}
            totalWidth={totalWidth}
            headerHeight={60} // TableHeaderの高さ(固定値)
          />
        </Table>
      </div>
    </div>
  );
};

/**
 * ============================================================================
 * ROOT
 * ============================================================================
 */

const queryClient = new QueryClient();

export default function DataTableV15() {
  const featureConfig: GridFeatureConfig = useMemo(
    () => ({
      defaultColumnSize: 120,
      enableRowSelection: true,
      enableColumnResizing: true,
      enableSorting: true,
      enableFiltering: true,
      pinnedRowIds: ["0", "5"],
      pinnedColIds: ["select", "0", "1"],
      aggregationColIds: ["3"],
      getCellStyle: ({ colId, value }) => {
        if (colId === "2")
          return { color: value === "Active" ? "green" : "gray" };
        if (colId === "3") return { textAlign: "right" };
        return {};
      },
    }),
    []
  );

  return (
    <QueryClientProvider client={queryClient}>
      <div className="p-8 bg-gray-100 min-h-screen">
        <InjectAndRender features={featureConfig} />
      </div>
    </QueryClientProvider>
  );
}

function InjectAndRender({ features }: { features: GridFeatureConfig }) {
  const controllerProps = useGridController(features);
  return <GridComponent {...controllerProps} />;
}
