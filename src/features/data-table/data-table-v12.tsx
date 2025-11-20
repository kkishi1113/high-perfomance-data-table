import React, {
  useMemo,
  useRef,
  useState,
  useEffect,
  type CSSProperties,
  type HTMLProps,
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
  type Table,
  type Row,
  type SortingState,
  type ColumnFiltersState,
  type RowSelectionState,
  type Header,
} from "@tanstack/react-table";
import { useVirtualizer, Virtualizer } from "@tanstack/react-virtual";

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
  // 追加機能フラグ
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
  table: Table<MatrixRow>;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  columnVirtualizer: Virtualizer<HTMLDivElement, Element>;
  parentRef: React.RefObject<HTMLDivElement | null>;
  featureConfig: GridFeatureConfig;
  pinnedRowsData: MatrixRow[];
  aggregatedData: Record<string, number | string>;
}

/**
 * ============================================================================
 * LAYER 2: PURE LOGIC (Utils & Helpers)
 * ============================================================================
 */

// --- Helper Components (DebouncedInput, Checkbox) ---

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

// --- Core Logic ---

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

    // 1. Selection Column (機能有効時のみ追加)
    if (featureConfig.enableRowSelection) {
      columns.push({
        id: "select",
        header: ({ table }) => (
          <IndeterminateCheckbox
            {...{
              checked: table.getIsAllRowsSelected(),
              indeterminate: table.getIsSomeRowsSelected(),
              onChange: table.getToggleAllRowsSelectedHandler(),
            }}
          />
        ),
        cell: ({ row }) => (
          <IndeterminateCheckbox
            {...{
              checked: row.getIsSelected(),
              disabled: !row.getCanSelect(),
              indeterminate: row.getIsSomeSelected(),
              onChange: row.getToggleSelectedHandler(),
            }}
          />
        ),
        size: 40,
        enableSorting: false,
        enableResizing: false,
        enableColumnFilter: false, // チェックボックス列はフィルタ不可
      });
    }

    // 2. Data Columns
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

  splitPinnedRows: (data: MatrixData, pinnedIds: string[] = []) => {
    if (pinnedIds.length === 0) return { pinned: [], scrollable: data };
    const pinnedSet = new Set(pinnedIds);
    const pinned: MatrixRow[] = [];
    const scrollable: MatrixRow[] = [];
    // IDは0番目のカラムと仮定
    for (const row of data) {
      if (pinnedSet.has(row[0])) {
        pinned.push(row);
      } else {
        scrollable.push(row);
      }
    }
    return { pinned, scrollable };
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    column: any,
    pinnedColIds: string[] = []
  ): CSSProperties => {
    const isPinned = pinnedColIds.includes(column.id);
    if (!isPinned) return {};
    return {
      position: "sticky",
      left: `${column.getStart("left")}px`,
      zIndex: 2, // ピン留め列はヘッダーよりさらに上、または同じレベル
      backgroundColor: "inherit", // 親の背景色を継承
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
      // 10万行 x 100列
      const data = Logic.createMockData(100, 200);
      return Object.freeze(data);
    },
    structuralSharing: false,
    staleTime: Infinity,
  });
};

const useGridController = (featureConfig: GridFeatureConfig): GridUIProps => {
  const { data, isLoading } = useGridData();
  const parentRef = useRef<HTMLDivElement>(null);

  // --- Table State Management ---
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // 固定行の分離
  const { pinned, scrollable } = useMemo(() => {
    if (!data) return { pinned: [], scrollable: [] };
    // NOTE: ソートやフィルタは「スクロール領域」に対してのみ適用されるのが一般的だが、
    // 全体に適用したい場合はアプローチが変わる。今回は簡易的に「元データ」から分離。
    return Logic.splitPinnedRows(
      data as MatrixData,
      featureConfig.pinnedRowIds
    );
  }, [data, featureConfig.pinnedRowIds]);

  // 集計
  const aggregatedData = useMemo(() => {
    if (!data) return {};
    return Logic.calculateAggregation(
      data as MatrixData,
      featureConfig.aggregationColIds
    );
  }, [data, featureConfig.aggregationColIds]);

  // カラム生成
  const columns = useMemo(() => {
    if (!data || data.length === 0) return [];
    return Logic.generateColumns(data[0].length, featureConfig);
  }, [data, featureConfig]);

  // Table Instance
  const table = useReactTable({
    data: scrollable,
    columns,
    state: {
      sorting,
      columnFilters,
      rowSelection,
      columnPinning: { left: featureConfig.pinnedColIds },
    },
    // Handlers
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    // Config
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(), // ソート機能
    getFilteredRowModel: getFilteredRowModel(), // フィルタ機能
    enableRowSelection: featureConfig.enableRowSelection,
    enableColumnResizing: featureConfig.enableColumnResizing,
    columnResizeMode: "onChange",
    meta: featureConfig.meta,
    // Row ID strategy (IDカラム: Index 0 を使用)
    getRowId: (row) => row[0],
  });

  // Virtualization
  const { rows } = table.getRowModel();
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 5,
  });

  const visibleColumns = table.getVisibleLeafColumns();
  const columnVirtualizer = useVirtualizer({
    count: visibleColumns.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => visibleColumns[index].getSize(),
    horizontal: true,
    overscan: 2,
  });

  // 【重要】カラムリサイズ時にVirtualizerを更新するためのEffect
  const { columnSizing } = table.getState();
  useEffect(() => {
    columnVirtualizer.measure();
  }, [columnSizing, columnVirtualizer]);

  return {
    isLoading,
    table,
    rowVirtualizer,
    columnVirtualizer,
    parentRef,
    featureConfig,
    pinnedRowsData: pinned,
    aggregatedData,
  };
};

/**
 * ============================================================================
 * LAYER 4: UI COMPONENTS (Refactored View)
 * ============================================================================
 */

// --- 4.1 Atom Components ---

const CellContent = ({
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
      className="flex items-center px-2 text-sm truncate border-r h-full bg-inherit"
      style={{
        width: `${cell.column.getSize()}px`,
        ...pinningStyle,
        ...customStyle,
      }}
    >
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </div>
  );
};

const ColumnResizer = ({ header }: { header: Header<MatrixRow, unknown> }) => {
  if (!header.column.getCanResize()) return null;
  return (
    <div
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
      onClick={(e) => e.stopPropagation()} // ソート発火防止
      className={`absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none bg-gray-300 opacity-0 hover:opacity-100 group-hover:opacity-100 ${
        header.column.getIsResizing() ? "bg-blue-500 opacity-100" : ""
      }`}
    />
  );
};

// --- 4.2 Sub-Organisms ---

const TableActions = ({ table }: { table: Table<MatrixRow> }) => {
  const selectedCount = Object.keys(table.getState().rowSelection).length;
  return (
    <div className="p-2 bg-gray-50 border-b flex items-center justify-between h-[50px]">
      <div className="text-sm font-medium text-gray-700">
        Grid Actions
        {selectedCount > 0 && (
          <span className="ml-4 text-blue-600 bg-blue-100 px-2 py-1 rounded-full text-xs">
            {selectedCount} selected
          </span>
        )}
      </div>
      <div className="flex gap-2">
        {/* ボタンなどを配置可能 */}
        <button
          className="text-xs border px-2 py-1 rounded bg-white hover:bg-gray-100"
          onClick={() => table.resetRowSelection()}
        >
          Clear Selection
        </button>
      </div>
    </div>
  );
};

const TableHeader = ({
  table,
  columnVirtualizer,
  featureConfig,
  topOffset = 0,
}: {
  table: Table<MatrixRow>;
  columnVirtualizer: Virtualizer<HTMLDivElement, Element>;
  featureConfig: GridFeatureConfig;
  topOffset: number;
}) => {
  const virtualCols = columnVirtualizer.getVirtualItems();
  //   const visibleColumns = table.getVisibleLeafColumns();
  const visibleHeaders = table.getFlatHeaders();
  const totalWidth = columnVirtualizer.getTotalSize();

  return (
    <div
      className="sticky z-30 flex bg-gray-100 border-b text-gray-600 font-medium shadow-sm"
      style={{
        top: `${topOffset}px`,
        width: `${totalWidth}px`,
        height: "60px", // フィルタ入力があるため高さを確保
      }}
    >
      {/* 左パディング */}
      <div
        style={{ width: `${virtualCols[0]?.start ?? 0}px`, flexShrink: 0 }}
      />

      {virtualCols.map((vc) => {
        const header = visibleHeaders[vc.index];
        const pinningStyle = Logic.getPinningStyle(
          header,
          featureConfig.pinnedColIds
        );

        return (
          <div
            key={header.id}
            className="group relative flex flex-col justify-between px-2 py-1 border-r text-xs uppercase tracking-wider bg-gray-100"
            style={{ width: `${header.getSize()}px`, ...pinningStyle }}
          >
            {/* Sort Header */}
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

            {/* Filter Input */}
            {header.column.getCanFilter() ? (
              <DebouncedInput
                type="text"
                value={(header.column.getFilterValue() ?? "") as string}
                onChange={(value) => header.column.setFilterValue(value)}
                placeholder="Search..."
                className="w-full mt-1 px-1 py-0.5 border rounded text-[10px] focus:outline-none focus:border-blue-400 font-normal"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div className="h-[20px]" /> // スペーサー
            )}

            {/* Resize Handle */}
            <ColumnResizer header={header} />
          </div>
        );
      })}
    </div>
  );
};

const PinnedRows = ({
  rows,
  table,
  columnVirtualizer,
  featureConfig,
}: {
  rows: MatrixRow[];
  table: Table<MatrixRow>;
  columnVirtualizer: Virtualizer<HTMLDivElement, Element>;
  featureConfig: GridFeatureConfig;
}) => {
  if (rows.length === 0) return null;
  const virtualCols = columnVirtualizer.getVirtualItems();
  const visibleColumns = table.getVisibleLeafColumns();

  return (
    <>
      {rows.map((row, rowIndex) => (
        <div
          key={`pinned-${rowIndex}`}
          className="flex h-[35px] bg-yellow-50 border-b border-yellow-100"
        >
          <div
            style={{ width: `${virtualCols[0]?.start ?? 0}px`, flexShrink: 0 }}
          />
          {virtualCols.map((vc) => {
            const col = visibleColumns[vc.index];
            // PinnedRow用の簡易Cellレンダリング (Contextがないため手動)
            const pinningStyle = Logic.getPinningStyle(
              col,
              featureConfig.pinnedColIds
            );
            // チェックボックス列などの特別対応が必要な場合はここで分岐
            const cellValue =
              col.id === "select" ? null : row[parseInt(col.id)];

            return (
              <div
                key={vc.key}
                className="flex items-center border-r px-2 text-sm font-bold text-gray-800 bg-yellow-50"
                style={{ width: `${col.getSize()}px`, ...pinningStyle }}
              >
                {cellValue}
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
};

const AggregateRows = ({
  aggregatedData,
  columnVirtualizer,
  table,
  featureConfig,
}: {
  aggregatedData: Record<string, string | number>;
  columnVirtualizer: Virtualizer<HTMLDivElement, Element>;
  table: Table<MatrixRow>;
  featureConfig: GridFeatureConfig;
}) => {
  if (Object.keys(aggregatedData).length === 0) return null;
  const virtualCols = columnVirtualizer.getVirtualItems();
  const visibleColumns = table.getVisibleLeafColumns();

  return (
    <div className="flex h-[35px] bg-blue-50 border-b border-blue-200 font-bold text-blue-900">
      <div
        style={{ width: `${virtualCols[0]?.start ?? 0}px`, flexShrink: 0 }}
      />
      {virtualCols.map((vc) => {
        const col = visibleColumns[vc.index];
        const pinningStyle = Logic.getPinningStyle(
          col,
          featureConfig.pinnedColIds
        );
        const val = aggregatedData[col.id];
        return (
          <div
            key={vc.key}
            className="flex items-center justify-end px-2 border-r text-sm bg-blue-50"
            style={{ width: `${col.getSize()}px`, ...pinningStyle }}
          >
            {val !== undefined ? `Sum: ${val.toLocaleString()}` : ""}
          </div>
        );
      })}
    </div>
  );
};

// --- 4.3 Container Organisms (Refactored per request) ---

const PinnedRowsArea = ({
  children,
  topOffset,
  totalWidth,
}: {
  children: React.ReactNode;
  topOffset: number;
  totalWidth: number;
}) => {
  return (
    <div
      className="sticky z-20 shadow-sm border-b-2 border-gray-300"
      style={{
        top: `${topOffset}px`, // Headerの下に来るように調整
        width: `${totalWidth}px`,
      }}
    >
      {children}
    </div>
  );
};

const TableRows = ({
  rows,
  rowVirtualizer,
  columnVirtualizer,
  featureConfig,
  virtualRowsStartOffset, // Header + PinnedRows の高さ分オフセット
}: {
  rows: Row<MatrixRow>[];
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  columnVirtualizer: Virtualizer<HTMLDivElement, Element>;
  featureConfig: GridFeatureConfig;
  virtualRowsStartOffset: number;
}) => {
  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualCols = columnVirtualizer.getVirtualItems();
  const totalWidth = columnVirtualizer.getTotalSize();

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        transform: `translateY(${virtualRows[0]?.start ?? 0}px)`,
      }}
    >
      {virtualRows.map((virtualRow) => {
        const row = rows[virtualRow.index];
        return (
          <div
            key={row.id}
            className={`flex absolute left-0 w-full border-b transition-colors ${
              row.getIsSelected() ? "bg-blue-50" : "bg-white hover:bg-gray-50"
            }`}
            style={{
              height: `${virtualRow.size}px`,
              transform: `translateY(${
                virtualRow.start - (virtualRows[0]?.start ?? 0)
              }px)`,
              top: `${virtualRowsStartOffset}px`,
              width: `${totalWidth}px`,
            }}
          >
            <div
              style={{
                width: `${virtualCols[0]?.start ?? 0}px`,
                flexShrink: 0,
              }}
            />
            {virtualCols.map((vc) => {
              const cell = row.getVisibleCells()[vc.index];
              return (
                <CellContent
                  key={cell.id}
                  cell={cell}
                  featureConfig={featureConfig}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

// --- 4.4 Main Layout Components ---

const TableBody = ({
  table,
  rows,
  pinnedRowsData,
  aggregatedData,
  rowVirtualizer,
  columnVirtualizer,
  featureConfig,
}: {
  table: Table<MatrixRow>;
  rows: Row<MatrixRow>[];
  pinnedRowsData: MatrixRow[];
  aggregatedData: Record<string, string | number>;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  columnVirtualizer: Virtualizer<HTMLDivElement, Element>;
  featureConfig: GridFeatureConfig;
}) => {
  const totalWidth = columnVirtualizer.getTotalSize();

  // 高さ計算: Header(60px) + PinnedRows + AggregateRows
  // Note: 本来は動的に計算すべきですが、ここでは固定値として計算
  const HEADER_HEIGHT = 60;
  const ROW_HEIGHT = 35;
  const pinnedAreaHeight =
    (Object.keys(aggregatedData).length > 0 ? ROW_HEIGHT : 0) +
    pinnedRowsData.length * ROW_HEIGHT;

  return (
    <div
      style={{
        position: "relative",
        width: `${totalWidth}px`,
        height: `${rowVirtualizer.getTotalSize()}px`,
      }}
    >
      {/* 1. ヘッダー */}
      <TableHeader
        table={table}
        columnVirtualizer={columnVirtualizer}
        featureConfig={featureConfig}
        topOffset={0}
      />

      {/* 2. 固定行エリア (Aggregation + Pinned) */}
      {(pinnedRowsData.length > 0 ||
        Object.keys(aggregatedData).length > 0) && (
        <PinnedRowsArea topOffset={HEADER_HEIGHT} totalWidth={totalWidth}>
          {/* ご要望通り Aggregate -> Pinned の順で配置 */}
          <AggregateRows
            aggregatedData={aggregatedData}
            columnVirtualizer={columnVirtualizer}
            table={table}
            featureConfig={featureConfig}
          />
          <PinnedRows
            rows={pinnedRowsData}
            table={table}
            columnVirtualizer={columnVirtualizer}
            featureConfig={featureConfig}
          />
        </PinnedRowsArea>
      )}

      {/* 3. メインスクロール行 */}
      <TableRows
        rows={rows}
        rowVirtualizer={rowVirtualizer}
        columnVirtualizer={columnVirtualizer}
        featureConfig={featureConfig}
        virtualRowsStartOffset={HEADER_HEIGHT + pinnedAreaHeight}
      />
    </div>
  );
};

const GridComponent = (props: GridUIProps) => {
  const {
    isLoading,
    table,
    rowVirtualizer,
    columnVirtualizer,
    parentRef,
    featureConfig,
    pinnedRowsData,
    aggregatedData,
  } = props;

  if (isLoading) {
    return (
      <div className="p-10 text-center text-gray-500">Loading Data...</div>
    );
  }

  // 仮想化対象のRowオブジェクトを取得
  const { rows } = table.getRowModel();

  return (
    <div className="border rounded-md overflow-hidden flex flex-col h-[600px] w-full bg-white relative shadow-lg">
      {/* 1. Actions Area */}
      <TableActions table={table} />

      {/* 2. Scroll Container */}
      <div ref={parentRef} className="overflow-auto w-full h-full relative">
        {/* 3. Table Layout */}
        <TableBody
          table={table}
          rows={rows}
          pinnedRowsData={pinnedRowsData}
          aggregatedData={aggregatedData}
          rowVirtualizer={rowVirtualizer}
          columnVirtualizer={columnVirtualizer}
          featureConfig={featureConfig}
        />
      </div>
    </div>
  );
};

/**
 * ============================================================================
 * ROOT COMPONENT
 * ============================================================================
 */

const queryClient = new QueryClient();

export default function DataTableV12() {
  const featureConfig: GridFeatureConfig = useMemo(
    () => ({
      defaultColumnSize: 120,
      enableRowSelection: true,
      enableColumnResizing: true,
      enableSorting: true,
      enableFiltering: true,

      pinnedRowIds: ["0", "5"],
      pinnedColIds: ["select", "0", "1"], // select列も左固定に含めると使いやすい
      aggregationColIds: ["3"], // 売上列などを集計

      meta: { focusedRowId: null },
      getCellStyle: ({ colId, value }) => {
        if (colId === "2") {
          return {
            color: value === "Active" ? "green" : "gray",
            fontWeight: value === "Active" ? "bold" : "normal",
          };
        }
        if (colId === "3") return { textAlign: "right" };
        return {};
      },
    }),
    []
  );

  return (
    <QueryClientProvider client={queryClient}>
      <div className="p-8 bg-gray-100 min-h-screen font-sans">
        <h1 className="text-2xl font-bold mb-4 text-gray-800">
          React Advanced Grid v2
        </h1>
        <p className="mb-4 text-gray-600 text-sm">
          Features: Virtualization, Sorting, Filtering, Resizing, Selection,
          Pinning, Aggregation
        </p>
        <InjectAndRender features={featureConfig} />
      </div>
    </QueryClientProvider>
  );
}

function InjectAndRender({ features }: { features: GridFeatureConfig }) {
  const controllerProps = useGridController(features);
  return <GridComponent {...controllerProps} />;
}
