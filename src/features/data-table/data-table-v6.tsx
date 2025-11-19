import { useRef } from "react";
import {
  QueryClient,
  QueryClientProvider,
  keepPreviousData,
  useQuery,
} from "@tanstack/react-query";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";

// 上記のMock API関数
import { fetchUserPage } from "../../../api";

const queryClient = new QueryClient();

const TOTAL_ROWS = 100000;
const TOTAL_COLS = 200;
const PAGE_SIZE = 50;

// --- メインコンポーネント ---
export default function ServerSideGrid() {
  return (
    <QueryClientProvider client={queryClient}>
      <Grid />
    </QueryClientProvider>
  );
}

function Grid() {
  const parentRef = useRef<HTMLDivElement>(null);

  // 1. 行（縦）の仮想化
  const rowVirtualizer = useVirtualizer({
    count: TOTAL_ROWS,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35, // 行の高さ
    overscan: 5, // スクロールのちらつき防止
  });

  // 2. 列（横）の仮想化
  const columnVirtualizer = useVirtualizer({
    count: TOTAL_COLS,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // 列の幅
    horizontal: true,
    overscan: 2,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualCols = columnVirtualizer.getVirtualItems();

  // パディング計算（スクロールバーのサイズ維持）
  const totalHeight = rowVirtualizer.getTotalSize();
  const totalWidth = columnVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start || 0 : 0;
  const paddingLeft = virtualCols.length > 0 ? virtualCols[0].start || 0 : 0;

  return (
    <div style={{ padding: "20px" }}>
      <h2>Server-Side Infinite Grid</h2>
      <p style={{ color: "#666", fontSize: "0.9rem" }}>
        Fetching 100k rows from server on demand. Scroll down fast!
      </p>

      <div
        ref={parentRef}
        style={{
          height: "600px",
          width: "100%",
          overflow: "auto",
          border: "1px solid #ccc",
        }}
      >
        <div
          style={{
            height: `${totalHeight}px`,
            width: `${totalWidth}px`,
            position: "relative",
          }}
        >
          {/* 見えている範囲だけを描画するコンテナ */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              transform: `translate(${paddingLeft}px, ${paddingTop}px)`,
              display: "grid",
              gridTemplateColumns: `repeat(${virtualCols.length}, 100px)`,
              gridTemplateRows: `repeat(${virtualRows.length}, 35px)`,
            }}
          >
            {virtualRows.map((virtualRow) => {
              // ここが重要: 行番号から「必要なページ番号」を算出
              // 例: 125行目なら、ページ2 (50行/ページ) のデータが必要
              const pageIndex = Math.floor(virtualRow.index / PAGE_SIZE);

              // その行のページ内でのインデックス (0~49)
              const rowIndexInPage = virtualRow.index % PAGE_SIZE;

              return (
                <RowRenderer
                  key={virtualRow.key}
                  pageIndex={pageIndex}
                  rowIndexInPage={rowIndexInPage}
                  virtualCols={virtualCols}
                  isEven={virtualRow.index % 2 === 0}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- 行を描画するコンポーネント ---
// ここで個別にuseQueryを呼ぶことで、必要なページだけをフェッチします
const RowRenderer = ({
  pageIndex,
  rowIndexInPage,
  virtualCols,
  isEven,
}: {
  pageIndex: number;
  rowIndexInPage: number;
  virtualCols: VirtualItem[];
  isEven: boolean;
}) => {
  // TanStack Query: 必要なページデータを取得
  // staleTimeを無限にすることで、一度読んだデータはキャッシュし続ける
  const { data, isPending, isError } = useQuery({
    queryKey: ["rows", pageIndex],
    queryFn: () => fetchUserPage(pageIndex),
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  });

  // データ取得中またはエラー時の表示
  if (isPending || !data) {
    return (
      <div
        style={{
          gridColumn: `1 / span ${virtualCols.length}`,
          background: isEven ? "#fff" : "#f9f9f9",
          borderBottom: "1px solid #eee",
          display: "flex",
          alignItems: "center",
          paddingLeft: "10px",
          color: "#ccc",
          fontSize: "0.8rem",
        }}
      >
        Loading row...
      </div>
    );
  }

  const rowData = data.rows[rowIndexInPage];

  // データはあるが、特定行が見つからない場合（最終ページ端数など）
  if (!rowData) return null;

  if (isError) {
    return (
      <div
        style={{
          gridColumn: `1 / span ${virtualCols.length}`,
          background: isEven ? "#fff" : "#f9f9f9",
          borderBottom: "1px solid #eee",
          display: "flex",
          alignItems: "center",
          paddingLeft: "10px",
          color: "#ccc",
          fontSize: "0.8rem",
        }}
      >
        Error loading row...
      </div>
    );
  }

  return (
    <>
      {virtualCols.map((virtualCol) => {
        // 列キーの決定 (id, col2, col3...)
        const colKey =
          virtualCol.index === 0
            ? "id"
            : virtualCol.index === 1
            ? "name"
            : `col${virtualCol.index}`;

        return (
          <div
            key={virtualCol.key}
            style={{
              borderRight: "1px solid #eee",
              borderBottom: "1px solid #eee",
              padding: "0 8px",
              display: "flex",
              alignItems: "center",
              overflow: "hidden",
              whiteSpace: "nowrap",
              fontSize: "0.85rem",
              backgroundColor: isEven ? "#fff" : "#f9f9f9",
            }}
          >
            {rowData[colKey]}
          </div>
        );
      })}
    </>
  );
};
