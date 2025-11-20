import React, { useMemo, useRef, useEffect, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type ColumnDef,
  flexRender,
  type Row,
  type Column,
  type ColumnPinningState,
  type RowPinningState,
} from "@tanstack/react-table";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import {
  useQuery,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

// --- 1. ユーティリティ & スタイル ---
const styles = {
  tableWrapper: "relative w-full overflow-auto border rounded-md bg-white",
  // 行コンテナ（Flex）
  rowFlex: "flex items-center w-full",

  // ヘッダー
  headerCell:
    "flex items-center px-3 text-sm font-bold text-gray-700 bg-gray-100 border-r border-b h-full whitespace-nowrap relative hover:bg-gray-200 transition-colors",

  // ボディセル
  cell: "flex items-center px-3 text-sm h-full whitespace-nowrap border-r border-b bg-white truncate",

  // 集計セル
  summaryCell:
    "flex items-center px-3 text-xs font-bold h-full border-r border-b bg-yellow-50 text-gray-600 truncate",

  input:
    "w-full px-2 py-1 text-xs border rounded mt-1 focus:outline-none focus:border-blue-500 font-normal",
  resizer:
    "absolute right-0 top-0 h-full w-1 bg-gray-300 hover:bg-blue-500 cursor-col-resize select-none touch-none opacity-0 group-hover:opacity-100 z-20",

  // 固定列用のスタイル
  stickyLeft: "sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]",
  stickyHeader: "sticky top-0 z-40", // ヘッダー全体を上に固定
};

// チェックボックスコンポーネント
function IndeterminateCheckbox({
  indeterminate,
  className = "",
  ...rest
}: { indeterminate?: boolean } & React.HTMLProps<HTMLInputElement>) {
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

// --- 2. データ取得 (Matrix形式) ---
type MatrixData = string[][];

const fetchAllData = async (): Promise<MatrixData> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const rows = 100000;
      const cols = 200;
      const matrix: string[][] = [];
      for (let i = 0; i < rows; i++) {
        const row = new Array(cols);
        row[0] = String(i);
        row[1] = `User ${i}`;
        for (let j = 2; j < cols; j++)
          row[j] = `${Math.floor(Math.random() * 1000)}`;
        matrix.push(row);
      }
      resolve(Object.freeze(matrix) as string[][]);
    }, 1000);
  });
};

const queryClient = new QueryClient();

export default function DataTableV10_1() {
  return (
    <QueryClientProvider client={queryClient}>
      <FeatureRichGrid />
    </QueryClientProvider>
  );
}

function FeatureRichGrid() {
  const parentRef = useRef<HTMLDivElement>(null);

  // データ取得
  const { data, isPending } = useQuery({
    queryKey: ["huge-matrix"],
    queryFn: fetchAllData,
    structuralSharing: false,
    staleTime: Infinity,
  });

  // --- 3. カラム定義 ---
  const columns = useMemo<ColumnDef<string[]>[]>(() => {
    if (!data) return [];

    const selectionCol: ColumnDef<string[]> = {
      id: "select",
      size: 40,
      header: ({ table }) => (
        <div className="flex items-center justify-center w-full h-full">
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
        <div className="flex items-center justify-center w-full h-full">
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
    };

    const dataCols: ColumnDef<string[]>[] = data[0].map((_, i) => ({
      id: i.toString(),
      header: i === 0 ? "ID" : i === 1 ? "Name" : `Col ${i}`,
      accessorFn: (row) => row[i],
      size: i === 1 ? 150 : 100,
    }));

    return [selectionCol, ...dataCols];
  }, [data]);

  // --- 4. TanStack Table 設定 ---
  // 行固定（Row Pinning）の状態管理
  const [rowPinning, setRowPinning] = useState<RowPinningState>({
    top: [], // ここに固定したい行IDを入れる (例: ['0', '1'] など)
    bottom: [],
  });

  // 列固定（Column Pinning）の初期状態
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({
    left: ["select", "0", "1"], // IDとNameを左に固定
    right: [],
  });

  const table = useReactTable({
    data: data ?? [],
    columns,
    state: {
      columnPinning,
      rowPinning,
    },
    onColumnPinningChange: setColumnPinning,
    onRowPinningChange: setRowPinning,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: true,
    enableColumnPinning: true,
    enableRowPinning: true,
    columnResizeMode: "onChange",
    getRowId: (row) => row[0],
    debugTable: false,
  });

  // --- 5. カラム分割 (固定列とスクロール列) ---
  // ここが重要：仮想化を行うのは「固定されていない列」だけにする
  //   const allVisibleColumns = table.getVisibleLeafColumns();
  //   const leftPinnedColumns = allVisibleColumns.filter(
  //     (col) => col.getIsPinned() === "left"
  //   );
  const leftPinnedColumns = table.getLeftLeafColumns();
  const leftPinnedHeaders = table.getLeftLeafHeaders();
  //   const unpinnedColumns = allVisibleColumns.filter((col) => !col.getIsPinned());
  const unpinnedColumns = table.getCenterLeafColumns();
  // const rightPinnedColumns = ... (省略: 必要なら追加)

  // 固定列の合計幅を計算（CSSのleftオフセット計算用）
  const leftPinnedWidth = leftPinnedColumns.reduce(
    (acc, col) => acc + col.getSize(),
    0
  );
  //   let leftPinnedWidth = 0;
  // leftPinnedColumns.forEach((col) => {
  //   leftPinnedWidth += col.getSize();
  // });

  // --- 6. 仮想化 (Virtualization) ---

  // 行の仮想化
  const { rows } = table.getRowModel();
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40, // 行高
    overscan: 10,
  });

  // 列の仮想化（Unpinnedのみ対象にする）
  const columnVirtualizer = useVirtualizer({
    count: unpinnedColumns.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => unpinnedColumns[index].getSize(),
    horizontal: true,
    overscan: 5,
  });

  // カラムリサイズ対応
  const { columnSizing } = table.getState();
  useEffect(() => {
    columnVirtualizer.measure();
  }, [columnSizing, columnVirtualizer]);

  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualCols = columnVirtualizer.getVirtualItems();

  // 全体の幅・高さ計算
  const totalVirtualWidth = columnVirtualizer.getTotalSize();
  const totalRowHeight = rowVirtualizer.getTotalSize();

  // 実際に描画する幅（固定列幅 + 仮想列幅）
  const totalWidth = leftPinnedWidth + totalVirtualWidth;

  // 固定行（Pinned Top Rows）
  const pinnedTopRows = table.getTopRows();

  if (isPending || !data)
    return (
      <div className="p-10 text-blue-600 animate-pulse">
        Loading 20M cells...
      </div>
    );

  // --- 7. 集計ロジック (簡易版) ---
  // 10万行のリアルタイム集計は重いので、ここでは静的な表示または
  // 「現在見えているデータの集計」などに留めるのが一般的ですが、
  // ここではダミーの集計値を表示するロジックとします。
  const renderSummaryCell = (colId: string) => {
    if (colId === "select") return "Total";
    if (colId === "0" || colId === "1") return "-";
    return "Avg: 500"; // ダミーデータ
  };

  return (
    <div className="p-4 font-sans text-gray-800 h-screen flex flex-col">
      <div className="mb-4 flex justify-between items-end">
        <div>
          <h2 className="text-xl font-bold">Advanced Data Grid</h2>
          <p className="text-sm text-gray-500">
            Fixed Columns: [Select, ID, Name] | Fixed Rows: [Summary, Pinned
            Rows]
          </p>
        </div>
        <div className="text-sm bg-blue-50 px-3 py-1 rounded">
          Rows: {rows.length.toLocaleString()} | Selected:{" "}
          {Object.keys(table.getState().rowSelection).length}
        </div>
      </div>

      {/* --- テーブルコンテナ --- */}
      <div
        ref={parentRef}
        className={styles.tableWrapper}
        style={{ height: "100%" }}
      >
        <div
          style={{
            height: `${totalRowHeight}px`, // スクロール領域の確保
            width: `${totalWidth}px`,
            position: "relative",
          }}
        >
          {/* =========================================
              Sticky Header Section (Header + Summary + Pinned Rows)
              ========================================= */}
          <div
            className={styles.stickyHeader}
            style={{ width: `${totalWidth}px` }}
          >
            {/* 1. Main Header Row */}
            <div className={styles.rowFlex} style={{ height: "50px" }}>
              {/* 固定列 (Left Pinned) */}
              {leftPinnedHeaders.map((header) => (
                <div
                  key={header.id}
                  className={`${styles.headerCell} ${styles.stickyLeft}`}
                  style={{
                    width: `${header.getSize()}px`,
                    left: `${header.getStart("left")}px`,
                  }}
                >
                  <div className="flex flex-col justify-between w-full h-full py-1">
                    <div
                      className="flex items-center cursor-pointer select-none font-bold text-xs uppercase"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {{ asc: " ▲", desc: " ▼" }[
                        header.column.getIsSorted() as string
                      ] ?? null}
                    </div>
                    {header.column.getCanFilter() && header.id !== "select" && (
                      <input
                        type="text"
                        value={(header.column.getFilterValue() ?? "") as string}
                        onChange={(e) =>
                          header.column.setFilterValue(e.target.value)
                        }
                        className={styles.input}
                        placeholder="Filter..."
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </div>
                  {/* リサイズハンドル */}
                  <div
                    onMouseDown={header.getResizeHandler()}
                    onTouchStart={header.getResizeHandler()}
                    className={`${styles.resizer} ${
                      header.column.getIsResizing()
                        ? "opacity-100 bg-blue-500"
                        : ""
                    }`}
                  />
                </div>
              ))}

              {/* 仮想列のスペース確保 */}
              <div
                style={{
                  width: `${virtualCols[0]?.start ?? 0}px`,
                  flexShrink: 0,
                }}
              />

              {/* 仮想列 (Unpinned) */}
              {virtualCols.map((vc) => {
                // const header = unpinnedColumns[vc.index];
                const header = table.getCenterLeafHeaders()[vc.index];
                return (
                  <div
                    key={header.id}
                    className={`${styles.headerCell} group`}
                    style={{ width: `${header.getSize()}px` }}
                  >
                    <div className="flex flex-col justify-between w-full h-full py-1">
                      <div
                        className="flex items-center cursor-pointer select-none font-bold text-xs uppercase"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {{ asc: " ▲", desc: " ▼" }[
                          header.column.getIsSorted() as string
                        ] ?? null}
                      </div>
                      <input
                        type="text"
                        value={(header.column.getFilterValue() ?? "") as string}
                        onChange={(e) =>
                          header.column.setFilterValue(e.target.value)
                        }
                        className={styles.input}
                        placeholder="Filter..."
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className={`${styles.resizer} ${
                        header.column.getIsResizing()
                          ? "opacity-100 bg-blue-500"
                          : ""
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* 2. Aggregation / Summary Row (集計行) */}
            <div
              className={`${styles.rowFlex} shadow-sm z-30`}
              style={{ height: "35px" }}
            >
              {/* 固定列部分 */}
              {leftPinnedColumns.map((col) => (
                <div
                  key={col.id}
                  className={`${styles.summaryCell} ${styles.stickyLeft} bg-yellow-100`}
                  style={{
                    width: `${col.getSize()}px`,
                    left: `${col.getStart("left")}px`,
                  }}
                >
                  {renderSummaryCell(col.id)}
                </div>
              ))}

              {/* スペーサー */}
              <div
                style={{
                  width: `${virtualCols[0]?.start ?? 0}px`,
                  flexShrink: 0,
                }}
              />

              {/* 仮想列部分 */}
              {virtualCols.map((vc) => {
                const col = unpinnedColumns[vc.index];
                return (
                  <div
                    key={col.id}
                    className={styles.summaryCell}
                    style={{ width: `${col.getSize()}px` }}
                  >
                    {renderSummaryCell(col.id)}
                  </div>
                );
              })}
            </div>

            {/* 3. Pinned Top Rows (データ行の固定) */}
            {pinnedTopRows.map((row) => (
              <RowRender
                key={row.id}
                row={row}
                leftPinnedColumns={leftPinnedColumns}
                unpinnedColumns={unpinnedColumns}
                virtualCols={virtualCols}
                virtualStart={virtualCols[0]?.start ?? 0}
                isPinned={true}
              />
            ))}
          </div>

          {/* =========================================
              Body Section (Scrollable Rows)
              ========================================= */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              // Header群の高さ分ずらすロジックが必要ですが、
              // TanStack Virtualは絶対配置で計算するため、
              // contentをtransformでずらすか、marginTopで対応します。
              // ここでは「最初の仮想行の開始位置」にHeader高さを足す方式をとります。
              // Header(50) + Summary(35) + PinnedRows(n * 40)
              // 簡易的に marginTop でヘッダー領域を避けます。
              marginTop: `${50 + 35 + pinnedTopRows.length * 40}px`,
            }}
          >
            {virtualRows.map((virtualRow) => {
              // 固定行に含まれる行は除外する場合のロジックが必要ですが、
              // TanStack Tableの `getTopRows` は通常のモデルからは除外されないため、
              // ここでIDチェックして重複描画を防ぐのがベターです。
              const row = rows[virtualRow.index];
              if (pinnedTopRows.find((pr) => pr.id === row.id)) return null;

              return (
                <RowRender
                  key={row.id}
                  row={row}
                  virtualRow={virtualRow}
                  leftPinnedColumns={leftPinnedColumns}
                  unpinnedColumns={unpinnedColumns}
                  virtualCols={virtualCols}
                  virtualStart={virtualCols[0]?.start ?? 0}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* デモ用操作パネル */}
      <div className="mt-2 p-2 bg-gray-50 border rounded flex gap-4 text-sm">
        <button
          className="px-3 py-1 bg-white border shadow-sm hover:bg-gray-100 rounded"
          onClick={() => {
            // ランダムな行をTop固定にするデモ
            const randomId = Math.floor(Math.random() * 100).toString();
            setRowPinning((old) => ({
              ...old,
              top: Array.from(new Set([...(old?.top ?? []), randomId])),
            }));
          }}
        >
          + Pin Random Row
        </button>
        <button
          className="px-3 py-1 bg-white border shadow-sm hover:bg-gray-100 rounded"
          onClick={() => setRowPinning({ top: [], bottom: [] })}
        >
          Clear Pinned Rows
        </button>
      </div>
    </div>
  );
}

// --- 行レンダリング用コンポーネント ---
// パフォーマンスのため、メモ化しても良いが、virtual map内なので今回は直接記述
const RowRender = ({
  row,
  virtualRow,
  leftPinnedColumns,
  unpinnedColumns,
  virtualCols,
  virtualStart,
  isPinned = false,
}: {
  row: Row<string[]>;
  virtualRow?: { index: number; start: number; size: number };
  leftPinnedColumns: Column<string[]>[];
  unpinnedColumns: Column<string[]>[];
  virtualCols: VirtualItem[];
  virtualStart: number;
  isPinned?: boolean;
}) => {
  const transform = virtualRow
    ? `translateY(${virtualRow.start - (virtualRow ? virtualRow.start : 0)}px)` // 相対配置にするためYは0ベースに近い形
    : undefined;

  return (
    <div
      data-selected={row.getIsSelected()}
      className={`${styles.rowFlex} ${
        isPinned
          ? "bg-blue-50 font-semibold border-b-2 border-blue-200"
          : "hover:bg-gray-50 data-[selected=true]:bg-blue-100"
      }`}
      style={{
        height: `${virtualRow ? virtualRow.size : 40}px`, // 固定行は40px固定
        position: isPinned ? "relative" : "absolute",
        top: isPinned ? 0 : 0, // Bodyコンテナ内での配置
        transform: isPinned ? undefined : `translateY(${virtualRow?.start}px)`,
        width: "100%",
      }}
    >
      {/* 固定列 (Sticky Left) */}
      {leftPinnedColumns.map((col) => {
        const cell = row.getVisibleCells().find((c) => c.column.id === col.id);
        if (!cell) return null;
        return (
          <div
            key={cell.id}
            className={`${styles.cell} ${styles.stickyLeft} ${
              isPinned ? "bg-blue-50" : "bg-white group-hover:bg-gray-50"
            }`}
            style={{
              width: `${col.getSize()}px`,
              left: `${col.getStart("left")}px`,
              backgroundColor: isPinned ? "#eff6ff" : undefined, // sticky要素の透過防止
            }}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </div>
        );
      })}

      {/* スペーサー */}
      <div style={{ width: `${virtualStart}px`, flexShrink: 0 }} />

      {/* 仮想列 */}
      {virtualCols.map((vc) => {
        const col = unpinnedColumns[vc.index];
        const cell = row.getVisibleCells().find((c) => c.column.id === col.id);
        if (!cell) return null;
        return (
          <div
            key={cell.id}
            className={styles.cell}
            style={{ width: `${col.getSize()}px` }}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </div>
        );
      })}
    </div>
  );
};
