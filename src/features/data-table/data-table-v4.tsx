import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
  createColumnHelper,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

// --- 1. データ生成ロジック (200列対応) ---
type Person = {
  id: string;
  [key: string]: string; // 動的なプロパティを許可
};

const makeData = (rowCount: number, colCount: number): Person[] => {
  return Array.from({ length: rowCount }, (_, i) => {
    const row: Person = {
      id: i.toString(),
      firstName: `First${i}`,
      lastName: `Last${i}`,
    };
    // 残りの列を動的に生成 (col3, col4, ... col200)
    for (let j = 3; j < colCount; j++) {
      row[`col${j}`] = `Val ${i}-${j}`;
    }
    return row;
  });
};

// --- 2. Debounced Input (フィルタ用) ---
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
      style={{ width: "100%", boxSizing: "border-box", fontSize: "0.8rem" }}
    />
  );
}

export default function HeavyGrid() {
  // 3. データとカラムの定義
  const data = useMemo(() => makeData(1000, 200), []); // 10万行 x 200列

  const columnHelper = createColumnHelper<Person>();
  const columns = useMemo(() => {
    const cols = [
      columnHelper.accessor("id", {
        header: () => "ID",
        cell: (info) => info.getValue(),
        size: 60,
      }),
      columnHelper.accessor("firstName", {
        header: () => "First Name",
        cell: (info) => info.getValue(),
        size: 120,
      }),
      columnHelper.accessor("lastName", {
        header: () => "Last Name",
        cell: (info) => info.getValue(),
        size: 120,
      }),
    ];
    // 残りの197列を定義
    for (let i = 3; i < 200; i++) {
      cols.push(
        columnHelper.accessor(`col${i}`, {
          header: () => `Col ${i}`,
          cell: (info) => info.getValue(),
          size: 100,
        })
      );
    }
    return cols;
  }, [columnHelper]);

  // 4. Table State
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  // 5. 仮想化の設定 (縦 & 横)
  const parentRef = useRef<HTMLDivElement>(null);
  const { rows } = table.getRowModel();
  const visibleColumns = table.getVisibleFlatColumns();
  const visibleHeaders = table.getFlatHeaders();

  // 縦方向 (Rows)
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35, // 行の高さ
    overscan: 10,
  });

  // 横方向 (Columns)
  const columnVirtualizer = useVirtualizer({
    count: visibleColumns.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => visibleColumns[index].getSize(), // 各列の幅を取得
    horizontal: true, // 横方向フラグ
    overscan: 5,
  });

  // 仮想化された列リスト
  const virtualColumns = columnVirtualizer.getVirtualItems();

  // パディング計算 (描画されていない部分のスペースを確保)
  // これによりスクロールバーのサイズと位置が正しく維持されます
  const virtualColStart = virtualColumns[0]?.start ?? 0;
  const virtualColEnd = virtualColumns[virtualColumns.length - 1]?.end ?? 0;
  const totalColWidth = columnVirtualizer.getTotalSize();

  return (
    <div style={{ padding: "20px" }}>
      <h2>200 Columns x 100k Rows Grid</h2>
      <p style={{ fontSize: "0.9rem", color: "#666" }}>
        Vertical & Horizontal Virtualization Active
      </p>

      {/* スクロールコンテナ */}
      <div
        ref={parentRef}
        style={{
          height: "600px",
          width: "1000px", // 画面幅に合わせて調整
          maxWidth: "100%",
          overflow: "auto", // 縦横スクロールバーを表示
          border: "1px solid #ccc",
          position: "relative",
        }}
      >
        <div
          style={{
            // 全体のサイズを確保
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: `${totalColWidth}px`,
            position: "relative",
          }}
        >
          {/* ヘッダー (Sticky) */}
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 1, // ボディより上に表示
              display: "flex",
              background: "#f0f0f0",
              borderBottom: "1px solid #ddd",
              width: `${totalColWidth}px`, // コンテナ幅いっぱいに広げる
            }}
          >
            {/* 左側の仮想パディング */}
            <div style={{ width: `${virtualColStart}px`, flexShrink: 0 }} />

            {/* 現在見えている列ヘッダーのみ描画 */}
            {virtualColumns.map((vc) => {
              const header = visibleHeaders[vc.index];
              return (
                <div
                  key={header.id}
                  style={{
                    width: `${header.getSize()}px`,
                    flexShrink: 0, // 縮小させない
                    padding: "8px",
                    borderRight: "1px solid #ddd",
                    boxSizing: "border-box",
                    fontWeight: "bold",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  {/* ソート */}
                  <div
                    onClick={header.column.getToggleSortingHandler()}
                    style={{ cursor: "pointer", marginBottom: "5px" }}
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
                  {/* フィルタ */}
                  {header.column.getCanFilter() ? (
                    <DebouncedInput
                      value={(header.column.getFilterValue() ?? "") as string}
                      onChange={(value) => header.column.setFilterValue(value)}
                      placeholder="Search"
                    />
                  ) : null}
                </div>
              );
            })}

            {/* 右側の仮想パディング */}
            <div
              style={{
                width: `${totalColWidth - virtualColEnd}px`,
                flexShrink: 0,
              }}
            />
          </div>

          {/* ボディ (Rows) */}
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            return (
              <div
                key={row.id}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: `${totalColWidth}px`,
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                  display: "flex",
                  background: virtualRow.index % 2 ? "#fff" : "#f9f9f9",
                }}
              >
                {/* 行内でも左側にパディングを入れる */}
                <div style={{ width: `${virtualColStart}px`, flexShrink: 0 }} />

                {/* 現在見えている列セルのみ描画 */}
                {virtualColumns.map((vc) => {
                  const cell = row.getVisibleCells()[vc.index];
                  return (
                    <div
                      key={cell.id}
                      style={{
                        width: `${cell.column.getSize()}px`,
                        flexShrink: 0,
                        padding: "0 8px",
                        borderBottom: "1px solid #eee",
                        borderRight: "1px solid #eee",
                        display: "flex",
                        alignItems: "center",
                        boxSizing: "border-box",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                      }}
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
      <p>
        Total: {rows.length} rows, {columns.length} columns
      </p>
    </div>
  );
}
