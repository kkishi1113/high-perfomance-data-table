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
  type RowPinningState, // 追加
  type Header,
  type Column,
} from "@tanstack/react-table";
import {
  useVirtualizer,
  Virtualizer,
  type VirtualItem,
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
  pinnedRowIds?: string[]; // 初期値として使用
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
  // 仮想化の都合上、固定列を常に表示するためにマージされた列リスト
  virtualColumns: VirtualItem[];
  // データ分割（レンダリング用）
  pinnedRows: Row<MatrixRow>[];
  scrollableRows: Row<MatrixRow>[];
  aggregatedData: Record<string, number | string>;
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
          <div className="px-1">
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
          <div className="px-1">
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
        size: 50, // チェックボックス列の幅
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

  // 仮想化リストと固定列をマージする重要なロジック
  // これがないと、右にスクロールしたときに左端の固定列がDOMから消えてしまう
  mergePinnedColumnsWithVirtual: (
    virtualColumns: VirtualItem[],
    allColumns: Column<MatrixRow>[],
    pinnedColIds: string[],
    columnVirtualizer: Virtualizer<HTMLDivElement, Element>
  ): VirtualItem[] => {
    const pinnedIndices = allColumns
      .filter((col) => pinnedColIds.includes(col.id))
      .map((_, i) => i); // select列などが含まれるためindexは再計算が必要だが、簡易的に前から順と仮定

    // 正確には table.getVisibleLeafColumns() のインデックスを使う
    const visibleLeafCols = allColumns;
    const pinnedIndexes = visibleLeafCols
      .map((c, i) => (pinnedColIds.includes(c.id) ? i : -1))
      .filter((i) => i !== -1);

    const virtualIndices = new Set(virtualColumns.map((vc) => vc.index));

    // 仮想リストに含まれていない固定列を作成
    const missingPinnedItems = pinnedIndexes
      .filter((index) => !virtualIndices.has(index))
      .map(
        (index) =>
          ({
            index,
            start: columnVirtualizer.getOffsetForIndex(index),
            size: columnVirtualizer.getSize(index),
            key: `pinned-${index}`,
            measureElement: (el: Element | null) => {}, // Dummy
          } as VirtualItem)
      );

    // マージしてインデックス順にソート
    return [...missingPinnedItems, ...virtualColumns].sort(
      (a, b) => a.index - b.index
    );
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
      zIndex: 10, // 固定列は手前に表示
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

  // State
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  // 【修正】RowPinning Stateの追加
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
      rowPinning, // State連携
      columnPinning: { left: featureConfig.pinnedColIds },
    },
    onSortingChange: (updater) => startTransition(() => setSorting(updater)),
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onRowPinningChange: setRowPinning, // Handler連携
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: featureConfig.enableRowSelection,
    enableColumnResizing: featureConfig.enableColumnResizing,
    enableRowPinning: true, // 行固定有効化
    columnResizeMode: "onChange",
    meta: featureConfig.meta,
    getRowId: (row) => row[0],
  });

  // 集計計算
  const aggregatedData = useMemo(() => {
    if (!data) return {};
    // 簡易実装のため全データで計算（実務ではフィルタ後データを使う場合もある）
    return Logic.calculateAggregation(
      data as MatrixData,
      featureConfig.aggregationColIds
    );
  }, [data, featureConfig.aggregationColIds]);

  // 【修正】行の分割 (TanStack Tableの機能を使用しても良いが、仮想化のために手動分割が安定する)
  // RowModelから全行を取得（ソート・フィルタ済み）
  const { rows } = table.getRowModel();

  // 固定行とスクロール行の分離
  const pinnedRowIds = new Set(rowPinning.top ?? []);
  const pinnedRows: Row<MatrixRow>[] = [];
  const scrollableRows: Row<MatrixRow>[] = [];

  rows.forEach((row) => {
    if (pinnedRowIds.has(row.id)) {
      pinnedRows.push(row);
    } else {
      scrollableRows.push(row);
    }
  });

  // Virtualization (Rows) - スクロール行のみを仮想化対象にする
  const rowVirtualizer = useVirtualizer({
    count: scrollableRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 5,
  });

  // Virtualization (Cols)
  const visibleColumns = table.getVisibleLeafColumns();
  const columnVirtualizer = useVirtualizer({
    count: visibleColumns.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => visibleColumns[index].getSize(),
    horizontal: true,
    overscan: 5, // 固定列付近のチラつき防止のため少し多めに
  });

  // 【修正】固定列が消えないようにマージ処理を実行
  const rawVirtualColumns = columnVirtualizer.getVirtualItems();
  const virtualColumns = useMemo(() => {
    return Logic.mergePinnedColumnsWithVirtual(
      rawVirtualColumns,
      visibleColumns,
      featureConfig.pinnedColIds ?? [],
      columnVirtualizer
    );
  }, [
    rawVirtualColumns,
    visibleColumns,
    featureConfig.pinnedColIds,
    columnVirtualizer,
  ]);

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
    virtualColumns, // マージ済みの列リスト
    pinnedRows,
    scrollableRows,
    aggregatedData,
  };
};

/**
 * ============================================================================
 * LAYER 4: UI COMPONENTS
 * ============================================================================
 */

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
};

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

// --- Sub-Components ---

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
      className="sticky top-0 z-30 flex bg-gray-100 border-b text-gray-600 font-medium shadow-sm"
      style={{
        width: `${totalWidth}px`,
        height: "60px",
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
            className="group absolute top-0 flex flex-col justify-between px-2 py-1 border-r text-xs uppercase tracking-wider bg-gray-100 box-border"
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

// 【修正】固定行コンポーネント
const PinnedRows = ({
  rows,
  virtualColumns,
  featureConfig,
}: {
  rows: Row<MatrixRow>[];
  virtualColumns: VirtualItem[];
  featureConfig: GridFeatureConfig;
}) => {
  if (rows.length === 0) return null;

  return (
    <>
      {rows.map((row) => (
        <div
          key={row.id}
          className="relative flex h-[35px] bg-yellow-50 border-b border-yellow-200 w-full"
        >
          {virtualColumns.map((vc) => {
            const cell = row.getVisibleCells()[vc.index];
            // 【修正】CellContentを再利用し、チェックボックス等も正しく描画
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

// 【修正】集計行コンポーネント
const AggregateRows = ({
  aggregatedData,
  virtualColumns,
  visibleColumns,
  featureConfig,
}: {
  aggregatedData: Record<string, string | number>;
  virtualColumns: VirtualItem[];
  visibleColumns: Column<MatrixRow>[];
  featureConfig: GridFeatureConfig;
}) => {
  if (Object.keys(aggregatedData).length === 0) return null;

  return (
    <div className="relative flex h-[35px] bg-blue-50 border-b border-blue-200 w-full font-bold text-blue-900">
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

// --- Main Layout Blocks ---

const Table = ({
  children,
  totalWidth,
  totalHeight,
}: {
  children: ReactNode;
  totalWidth: number;
  totalHeight: number;
}) => (
  <div
    style={{
      position: "relative",
      width: `${totalWidth}px`,
      height: `${totalHeight}px`,
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
}: {
  pinnedRows: Row<MatrixRow>[];
  scrollableRows: Row<MatrixRow>[];
  aggregatedData: Record<string, string | number>;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  virtualColumns: VirtualItem[];
  visibleColumns: Column<MatrixRow>[];
  featureConfig: GridFeatureConfig;
  totalWidth: number;
}) => {
  const virtualRows = rowVirtualizer.getVirtualItems();

  // 高さ計算
  const HEADER_HEIGHT = 60;
  const ROW_HEIGHT = 35;
  const pinnedAreaHeight =
    (Object.keys(aggregatedData).length > 0 ? ROW_HEIGHT : 0) +
    pinnedRows.length * ROW_HEIGHT;
  const bodyStartOffset = HEADER_HEIGHT + pinnedAreaHeight;

  return (
    <>
      {/* A. Pinned & Aggregated Area (Sticky) */}
      {(pinnedRows.length > 0 || Object.keys(aggregatedData).length > 0) && (
        <div
          className="sticky z-20 shadow-sm border-b-2 border-gray-300 bg-white"
          style={{ top: `${HEADER_HEIGHT}px`, width: `${totalWidth}px` }}
        >
          <AggregateRows
            aggregatedData={aggregatedData}
            virtualColumns={virtualColumns}
            visibleColumns={visibleColumns}
            featureConfig={featureConfig}
          />
          <PinnedRows
            rows={pinnedRows}
            virtualColumns={virtualColumns}
            featureConfig={featureConfig}
          />
        </div>
      )}

      {/* B. Virtual Scrollable Area */}
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%" }}>
        {virtualRows.map((virtualRow) => {
          const row = scrollableRows[virtualRow.index];
          return (
            <div
              key={row.id}
              className={`absolute left-0 w-full flex border-b transition-colors ${
                row.getIsSelected() ? "bg-blue-50" : "bg-white hover:bg-gray-50"
              }`}
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${
                  virtualRow.start - (virtualRows[0]?.start ?? 0)
                }px)`,
                top: `${bodyStartOffset}px`,
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
    columnVirtualizer,
    parentRef,
    featureConfig,
    virtualColumns, // マージ済みの列
    pinnedRows,
    scrollableRows,
    aggregatedData,
  } = props;

  if (isLoading) return <div className="p-10 text-center">Loading...</div>;

  const totalWidth = columnVirtualizer.getTotalSize();
  const totalHeight = rowVirtualizer.getTotalSize();
  const visibleColumns = table.getVisibleLeafColumns();

  return (
    <div className="border rounded-md overflow-hidden flex flex-col h-[600px] w-full bg-white relative shadow-lg">
      {/* Actions */}
      <div className="p-2 bg-gray-50 border-b flex items-center justify-between h-[50px]">
        <span className="text-sm font-bold">
          {isSorting ? "Sorting..." : "Grid Ready"}
        </span>
        <button
          className="text-xs border px-2 py-1 bg-white"
          onClick={() => table.resetRowSelection()}
        >
          Clear Select
        </button>
      </div>

      {/* Scroll Container */}
      <div ref={parentRef} className="overflow-auto w-full h-full relative">
        <Table totalWidth={totalWidth} totalHeight={totalHeight}>
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

export default function App() {
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
