import React, { useMemo, useRef, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type ColumnDef,
  flexRender,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useQuery,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

// --- 1. ユーティリティ & スタイル ---
const styles = {
  tableWrapper: "relative w-full overflow-auto border rounded-md bg-white",
  headerRow:
    "flex border-b bg-gray-100 sticky top-0 z-10 font-medium text-gray-700",
  bodyRow: "flex border-b hover:bg-gray-50 data-[selected=true]:bg-blue-50",
  cell: "flex items-center px-3 text-sm align-middle h-full truncate border-r last:border-r-0",
  input:
    "w-full px-2 py-1 text-xs border rounded mt-1 focus:outline-none focus:border-blue-500",
  resizer:
    "absolute right-0 top-0 h-full w-1 bg-gray-300 hover:bg-blue-500 cursor-col-resize select-none touch-none opacity-0 group-hover:opacity-100",
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
      const rows = 100000; // 10万行
      const cols = 200; // 200列
      const matrix: string[][] = [];
      for (let i = 0; i < rows; i++) {
        const row = new Array(cols);
        row[0] = String(i); // IDとして使用
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

export default function DataTableV10() {
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

  // --- 3. カラム定義の動的生成 ---
  const columns = useMemo<ColumnDef<string[]>[]>(() => {
    if (!data) return [];

    // (1) 選択用チェックボックス列
    const selectionCol: ColumnDef<string[]> = {
      id: "select",
      size: 50,
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
    };

    // (2) データ列 (配列のインデックスをキーにする)
    const dataCols: ColumnDef<string[]>[] = data[0].map((_, i) => ({
      id: i.toString(),
      header: i === 0 ? "ID" : i === 1 ? "Name" : `Col ${i}`,
      // 重要: Matrixデータなので、アクセサ関数でインデックス指定する
      accessorFn: (row) => row[i],
      size: i === 1 ? 150 : 100, // 初期の幅
    }));

    return [selectionCol, ...dataCols];
  }, [data]);

  // --- 4. TanStack Table の設定 ---
  const table = useReactTable({
    data: data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: true,
    columnResizeMode: "onChange", // リアルタイムリサイズ
    getRowId: (row) => row[0], // 0番目のカラム(ID)を行IDとして使う（選択状態の維持に必須）
    debugTable: false,
  });

  // --- 5. 仮想化 (Tableの状態と連動) ---

  // フィルタ・ソート済みの行を取得
  const { rows } = table.getRowModel();
  const visibleColumns = table.getVisibleLeafColumns();
  const visibleHeaders = table.getFlatHeaders();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 45, // 行の高さ
    overscan: 5,
  });

  // 6. Tableの状態から columnSizing を取得
  const { columnSizing } = table.getState();

  const columnVirtualizer = useVirtualizer({
    count: visibleColumns.length,
    getScrollElement: () => parentRef.current,
    // ここで最新のサイズを取得するように記述されていますが、
    // Virtualizerは能動的にこれを再読込しないため、下のuseEffectが必要です
    estimateSize: (index) => visibleColumns[index].getSize(), // Tableが持つ幅情報を使う
    horizontal: true,
    overscan: 5, // リサイズ時のチラつき防止に少し多めにするのがおすすめ
  });

  // 【追加】これが必要です！
  // カラムのサイズが変わるたびに、Virtualizerに「サイズ測り直して！」と伝える
  useEffect(() => {
    columnVirtualizer.measure();
  }, [columnSizing, columnVirtualizer]);

  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualCols = columnVirtualizer.getVirtualItems();

  // パディング計算
  const totalHeight = rowVirtualizer.getTotalSize();
  const totalWidth = columnVirtualizer.getTotalSize();

  if (isPending || !data)
    return <div className="p-10">Loading 20M cells...</div>;

  return (
    <div className="p-4 font-sans text-gray-800">
      <h2 className="text-xl font-bold mb-2">
        Full Features: Sort, Filter, Resize, Select
      </h2>
      <div className="text-sm text-gray-500 mb-4">
        Selected Rows: {Object.keys(table.getState().rowSelection).length}
      </div>

      <div
        ref={parentRef}
        className={styles.tableWrapper}
        style={{ height: "600px" }}
      >
        <div
          style={{
            height: `${totalHeight}px`,
            width: `${totalWidth}px`,
            position: "relative",
          }}
        >
          {/* --- ヘッダー (Sticky) --- */}
          <div
            className={styles.headerRow}
            style={{ width: `${totalWidth}px` }}
          >
            {/* 左パディング */}
            <div
              style={{
                width: `${virtualCols[0]?.start ?? 0}px`,
                flexShrink: 0,
              }}
            />

            {virtualCols.map((vc) => {
              //   const header = visibleColumns[vc.index];
              const header = visibleHeaders[vc.index];
              return (
                <div
                  key={header.id}
                  className={`${styles.cell} relative group flex flex-col justify-between py-2`}
                  style={{ width: `${header.getSize()}px` }}
                >
                  {/* ソート機能 */}
                  <div
                    className="flex items-center cursor-pointer select-none w-full font-bold"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                    {{
                      asc: " 🔼",
                      desc: " 🔽",
                    }[header.column.getIsSorted() as string] ?? null}
                  </div>

                  {/* フィルタ入力 (チェックボックス列以外) */}
                  {header.column.getCanFilter() && header.id !== "select" ? (
                    <input
                      type="text"
                      value={(header.column.getFilterValue() ?? "") as string}
                      onChange={(e) =>
                        header.column.setFilterValue(e.target.value)
                      }
                      placeholder="Filter..."
                      className={styles.input}
                      // 入力時にソートが反応しないように
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : null}

                  {/* リサイズハンドル */}
                  <div
                    onMouseDown={header.getResizeHandler()}
                    onTouchStart={header.getResizeHandler()}
                    className={`${styles.resizer} ${
                      header.column.getIsResizing()
                        ? "bg-blue-500 opacity-100"
                        : ""
                    }`}
                  />
                </div>
              );
            })}
          </div>

          {/* --- ボディ --- */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              // ヘッダーの高さ(約75px)分ずらす
              transform: `translateY(${virtualRows[0]?.start ?? 0}px)`,
            }}
          >
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <div
                  key={row.id}
                  data-selected={row.getIsSelected()}
                  className={styles.bodyRow}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${
                      virtualRow.start - (virtualRows[0]?.start ?? 0)
                    }px)`,
                    position: "absolute",
                    top: "75px", // ヘッダーの高さ
                    left: 0,
                    width: `${totalWidth}px`,
                  }}
                >
                  {/* 左パディング */}
                  <div
                    style={{
                      width: `${virtualCols[0]?.start ?? 0}px`,
                      flexShrink: 0,
                    }}
                  />

                  {virtualCols.map((vc) => {
                    const cell = row.getVisibleCells()[vc.index];
                    return (
                      <div
                        key={cell.id}
                        className={styles.cell}
                        style={{ width: `${cell.column.getSize()}px` }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
