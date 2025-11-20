import React, { useMemo, useRef, type CSSProperties } from "react";
import {
  useQuery,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
  flexRender,
  type Cell,
  type Table,
} from "@tanstack/react-table";
import {
  useVirtualizer,
  Virtualizer,
  type VirtualItem,
} from "@tanstack/react-virtual";

/**
 * ============================================================================
 * LAYER 1: DOMAIN & INTERFACES (型定義)
 * ----------------------------------------------------------------------------
 * 仕様変更に強いコードにするため、すべての機能をインターフェースに依存させます。
 * ============================================================================
 */

// データ構造: メモリ効率のためマトリックス(配列の配列)を採用
export type MatrixRow = string[];
export type MatrixData = MatrixRow[];

// 外部から注入可能な機能（Features）の定義
export interface GridFeatureConfig {
  // 1. カラム設定
  defaultColumnSize?: number;

  // 2. 見た目のカスタマイズ
  getCellStyle?: (params: {
    rowId: string;
    colId: string;
    value: string;
    isPinned: boolean;
  }) => CSSProperties;

  // 3. 固定機能 (IDの配列で指定)
  pinnedRowIds?: string[];
  pinnedColIds?: string[]; // 'left' | 'right' の制御も可能だが今回は簡易化のため左固定と仮定

  // 4. 集計機能
  aggregationColIds?: string[];

  // 5. 外部メタデータ (Focus状態やアプリケーション固有のコンテキスト)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meta?: Record<string, any>;
}

// UIコンポーネントに必要なProps
export interface GridUIProps {
  isLoading: boolean;
  table: ReturnType<typeof useReactTable<MatrixRow>>;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>; // Virtualizerの型は複雑なためany/推論に任せる箇所
  columnVirtualizer: Virtualizer<HTMLDivElement, Element>;
  parentRef: React.RefObject<HTMLDivElement | null>;
  featureConfig: GridFeatureConfig;
  pinnedRowsData: MatrixRow[]; // 固定行のデータ
  aggregatedData: Record<string, number | string>; // 集計データ
}

/**
 * ============================================================================
 * LAYER 2: PURE LOGIC (純粋ロジック)
 * ----------------------------------------------------------------------------
 * Reactの状態や副作用に依存しない計算ロジック。単体テストが可能です。
 * ============================================================================
 */

const Logic = {
  // データの生成 (Mock)
  createMockData: (rows: number, cols: number): MatrixData => {
    const matrix: MatrixData = [];
    for (let i = 0; i < rows; i++) {
      const row = new Array(cols);
      row[0] = String(i); // ID
      row[1] = `User ${i}`;
      row[2] = i % 3 === 0 ? "Active" : "Inactive";
      row[3] = String(Math.floor(Math.random() * 10000)); // Sales (集計用)
      for (let j = 4; j < cols; j++)
        row[j] = `${Math.floor(Math.random() * 100)}`;
      matrix.push(row);
    }
    return matrix; // Object.freezeはAPI層で行う想定
  },

  // カラム定義の生成
  generateColumns: (
    colCount: number,
    featureConfig: GridFeatureConfig
  ): ColumnDef<MatrixRow>[] => {
    return Array.from({ length: colCount }, (_, i) => ({
      id: String(i),
      header:
        i === 0 ? "ID" : i === 1 ? "Name" : i === 2 ? "Status" : `Col ${i}`,
      accessorFn: (row) => row[i],
      size: featureConfig.defaultColumnSize ?? 100, // デフォルトサイズ機能
    }));
  },

  // 固定行とスクロール行の分離
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

  // 集計計算 (単純な合計)
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
        if (!isNaN(val)) {
          result[colId] += val;
        }
      }
    }
    return result;
  },

  // CSS: カラム固定用のスタイル計算
  getPinningStyle: (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    column: any,
    pinnedColIds: string[] = []
  ): CSSProperties => {
    const isPinned = pinnedColIds.includes(column.id);
    if (!isPinned) return {};

    // 簡易的な左固定の実装。
    // 本来は「自分の左にある固定列の合計幅」を計算する必要がありますが、
    // ここでは概念実証として最初の数行固定を想定して固定値または動的計算を行います。
    // TanStack Tableの getStart() を使うのが正攻法です。
    return {
      position: "sticky",
      left: `${column.getStart("left")}px`,
      zIndex: 1,
      backgroundColor: "#fafafa", // 固定列は背景色がないと透ける
    };
  },
};

/**
 * ============================================================================
 * LAYER 3: DATA & STATE LOGIC (Hooks)
 * ----------------------------------------------------------------------------
 * API通信と、ライブラリ(TanStack)の初期化を行う「コントローラー」層です。
 * ============================================================================
 */

// 3.1 API Fetcher
const useGridData = () => {
  return useQuery({
    queryKey: ["gridData"],
    queryFn: async () => {
      // APIコールの代わり
      await new Promise((resolve) => setTimeout(resolve, 800));
      const data = Logic.createMockData(100000, 200); // 1万行 x 50列
      return Object.freeze(data);
    },
    structuralSharing: false,
    staleTime: Infinity,
  });
};

// 3.2 Main Controller Hook
const useGridController = (featureConfig: GridFeatureConfig): GridUIProps => {
  const { data, isLoading } = useGridData();
  const parentRef = useRef<HTMLDivElement>(null);

  // データ処理: 固定行とスクロール行の分離
  const { pinned, scrollable } = useMemo(() => {
    if (!data) return { pinned: [], scrollable: [] };
    return Logic.splitPinnedRows(
      data as MatrixData,
      featureConfig.pinnedRowIds
    );
  }, [data, featureConfig.pinnedRowIds]);

  // 集計データの計算
  const aggregatedData = useMemo(() => {
    if (!data) return {};
    return Logic.calculateAggregation(
      data as MatrixData,
      featureConfig.aggregationColIds
    );
  }, [data, featureConfig.aggregationColIds]);

  // カラム定義
  const columns = useMemo(() => {
    if (!data || data.length === 0) return [];
    return Logic.generateColumns(data[0].length, featureConfig);
  }, [data, featureConfig]);

  // Table Instance
  const table = useReactTable({
    data: scrollable, // 仮想スクロールには「固定行以外」を渡す
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: {
      // 列固定の状態をTanStack Tableに注入
      columnPinning: {
        left: featureConfig.pinnedColIds,
      },
    },
    meta: featureConfig.meta, // メタデータの注入
  });

  // Virtualization (Row)
  const { rows } = table.getRowModel();
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 5,
  });

  // Virtualization (Col)
  const visibleColumns = table.getVisibleLeafColumns();
  const columnVirtualizer = useVirtualizer({
    count: visibleColumns.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => visibleColumns[index].getSize(),
    horizontal: true,
    overscan: 2,
  });

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
 * LAYER 4: UI COMPONENTS (View)
 * ----------------------------------------------------------------------------
 * ロジックを持たず、Propsを表示するだけのコンポーネント群。
 * ============================================================================
 */

// 4.1 Atom: Cell Component
const CellRenderer = React.memo(
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

    // Feature: セルの色やスタイル
    const customStyle = featureConfig.getCellStyle?.({
      rowId,
      colId,
      value,
      isPinned,
    });

    // Logic: ピン留めのスタイル計算
    const pinningStyle = Logic.getPinningStyle(
      cell.column,
      featureConfig.pinnedColIds
    );

    return (
      <div
        className="flex items-center border-b border-r px-2 text-sm truncate bg-white"
        style={{
          width: `${cell.column.getSize()}px`,
          height: "100%",
          ...pinningStyle, // 固定列のCSS
          ...customStyle, // ユーザー定義CSS
        }}
      >
        {flexRender(cell.column.columnDef.cell, cell.getContext())}
      </div>
    );
  }
);

// 4.2 Molecule: Pinned Rows Area (固定行表示エリア)
const PinnedRowsArea = ({
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

  // 列の仮想化は共通で使う
  const virtualCols = columnVirtualizer.getVirtualItems();
  const visibleColumns = table.getVisibleLeafColumns();

  return (
    <div className="sticky top-0 z-20 shadow-md bg-yellow-50 border-b-2 border-yellow-200">
      {rows.map((row, rowIndex) => (
        <div key={`pinned-${rowIndex}`} className="flex h-[35px]">
          {/* 左パディング */}
          <div
            style={{ width: `${virtualCols[0]?.start ?? 0}px`, flexShrink: 0 }}
          />

          {virtualCols.map((vc: VirtualItem) => {
            const col = visibleColumns[vc.index];
            // 簡易的なセルレンダリング (本来はCellRendererを再利用すべきだが、contextが違うため簡易化)
            // const isPinned = featureConfig.pinnedColIds?.includes(col.id);
            const pinningStyle = Logic.getPinningStyle(
              col,
              featureConfig.pinnedColIds
            );
            return (
              <div
                key={vc.key}
                className="flex items-center border-r px-2 text-sm font-bold text-gray-800"
                style={{
                  width: `${col.getSize()}px`,
                  ...pinningStyle,
                  backgroundColor: "#fffbeb",
                }}
              >
                {row[parseInt(col.id)]}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// 4.3 Molecule: Footer Area (集計行)
const FooterArea = ({
  aggregatedData,
  columnVirtualizer,
  table,
}: {
  aggregatedData: Record<string, string | number>;
  columnVirtualizer: Virtualizer<HTMLDivElement, Element>;
  table: Table<MatrixRow>;
}) => {
  const virtualCols = columnVirtualizer.getVirtualItems();
  const visibleColumns = table.getVisibleLeafColumns();

  if (Object.keys(aggregatedData).length === 0) return null;

  return (
    <div className="sticky bottom-0 z-20 bg-gray-100 border-t-2 border-gray-300 font-bold h-[35px] flex items-center">
      <div
        style={{ width: `${virtualCols[0]?.start ?? 0}px`, flexShrink: 0 }}
      />
      {virtualCols.map((vc: VirtualItem) => {
        const col = visibleColumns[vc.index];
        const val = aggregatedData[col.id];
        return (
          <div
            key={vc.key}
            className="px-2 border-r text-right text-sm"
            style={{ width: `${col.getSize()}px` }}
          >
            {val !== undefined ? `Sum: ${val.toLocaleString()}` : ""}
          </div>
        );
      })}
    </div>
  );
};

// 4.4 Organism: Main Grid Component
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

  const { rows } = table.getRowModel();
  //   const visibleColumns = table.getVisibleLeafColumns();
  const visibleHeaders = table.getFlatHeaders();

  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualCols = columnVirtualizer.getVirtualItems();

  const totalWidth = columnVirtualizer.getTotalSize();
  const totalHeight = rowVirtualizer.getTotalSize();

  return (
    <div className="border rounded-md overflow-hidden flex flex-col h-[600px] w-full bg-white relative">
      {/* Main Scroll Container */}
      <div ref={parentRef} className="overflow-auto w-full h-full relative">
        <div
          style={{
            height: `${totalHeight}px`,
            width: `${totalWidth}px`,
            position: "relative",
          }}
        >
          {/* A. 固定行エリア (Sticky Top) */}
          <PinnedRowsArea
            rows={pinnedRowsData}
            table={table}
            columnVirtualizer={columnVirtualizer}
            featureConfig={featureConfig}
          />

          {/* B. ヘッダーエリア (Sticky, 固定行の下) */}
          {/* ※簡易実装のため、固定行の下にヘッダーが来る構成にしていますが、
              通常はヘッダーが一番上です。順序は要件次第で入れ替え可能です。 */}
          <div
            className="sticky z-10 flex bg-gray-50 border-b text-gray-600 font-medium h-[35px]"
            style={{
              top: `${pinnedRowsData.length * 35}px`,
              width: `${totalWidth}px`,
            }}
          >
            <div
              style={{
                width: `${virtualCols[0]?.start ?? 0}px`,
                flexShrink: 0,
              }}
            />
            {virtualCols.map((vc: VirtualItem) => {
              const header = visibleHeaders[vc.index];
              const pinningStyle = Logic.getPinningStyle(
                header,
                featureConfig.pinnedColIds
              );
              return (
                <div
                  key={header.id}
                  className="flex items-center px-2 border-r text-xs uppercase tracking-wider bg-gray-50"
                  style={{ width: `${header.getSize()}px`, ...pinningStyle }}
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                </div>
              );
            })}
          </div>

          {/* C. ボディエリア (仮想スクロール) */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              // ヘッダーや固定行の分だけ位置を調整する場合はここにtransformなどを足す
              // 今回はabsolute配置でY座標を指定しているため、親のrelativeに対する位置になります
            }}
          >
            {virtualRows.map((virtualRow: VirtualItem) => {
              const row = rows[virtualRow.index];
              return (
                <div
                  key={row.id}
                  className="flex absolute left-0 w-full hover:bg-gray-50 transition-colors"
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    // 固定行がある場合、その分下にずらす必要がある
                    marginTop: `${(pinnedRowsData.length + 1) * 35}px`,
                  }}
                >
                  <div
                    style={{
                      width: `${virtualCols[0]?.start ?? 0}px`,
                      flexShrink: 0,
                    }}
                  />

                  {virtualCols.map((vc: VirtualItem) => {
                    const cell = row.getVisibleCells()[vc.index];
                    return (
                      <CellRenderer
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
        </div>

        {/* D. 集計フッター (Sticky Bottom) */}
        <FooterArea
          aggregatedData={aggregatedData}
          columnVirtualizer={columnVirtualizer}
          table={table}
        />
      </div>
    </div>
  );
};

/**
 * ============================================================================
 * ROOT COMPONENT (Dependency Injection)
 * ----------------------------------------------------------------------------
 * ここで機能を定義し、Gridに注入します。
 * ============================================================================
 */

const queryClient = new QueryClient();

export default function DataTableV11() {
  // 機能(Features)の定義: ここを変えるだけでグリッドの挙動が変わる
  const featureConfig: GridFeatureConfig = useMemo(
    () => ({
      defaultColumnSize: 120,

      // 条件付きスタイル (StatusがInactiveならグレー、Activeなら太字)
      getCellStyle: ({ colId, value }) => {
        if (colId === "2") {
          // Status Column
          return {
            color: value === "Active" ? "green" : "gray",
            fontWeight: value === "Active" ? "bold" : "normal",
          };
        }
        if (colId === "3") {
          // Sales Column
          return { textAlign: "right" };
        }
        return {};
      },

      // 行のピン留め (ID指定)
      pinnedRowIds: ["0", "5"],

      // 列のピン留め (ID指定) -> ID:0, 1 (IDとName)を左に固定
      pinnedColIds: ["0", "1"],

      // 集計機能 (Col 3: Salesを集計)
      aggregationColIds: ["3"],

      // 外部メタデータ
      meta: {
        focusedRowId: null,
      },
    }),
    []
  );

  return (
    <QueryClientProvider client={queryClient}>
      <div className="p-8 bg-gray-100 min-h-screen">
        <h1 className="text-2xl font-bold mb-4">Clean Architecture Grid</h1>
        {/* Controller Hooksを使ってPropsを生成し、UIに渡す */}
        <InjectAndRender features={featureConfig} />
      </div>
    </QueryClientProvider>
  );
}

// ControllerとViewを結合するラッパー
function InjectAndRender({ features }: { features: GridFeatureConfig }) {
  const controllerProps = useGridController(features);
  return <GridComponent {...controllerProps} />;
}
