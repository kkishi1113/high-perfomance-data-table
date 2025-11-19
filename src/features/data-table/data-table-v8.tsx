import React, { useRef } from "react";
import {
  useQuery,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";

// --- 1. API (Matrix形式で返す) ---
type MatrixData = string[][];

const fetchAllData = async (): Promise<MatrixData> => {
  // 実際のAPIリクエスト
  // const res = await fetch('/api/huge-data');
  // return res.json();

  // ここではモック
  return new Promise((resolve) => {
    setTimeout(() => {
      const rows = 100000;
      const cols = 200;
      const matrix: string[][] = [];
      for (let i = 0; i < rows; i++) {
        const row = new Array(cols);
        row[0] = String(i);
        row[1] = `User ${i}`;
        for (let j = 2; j < cols; j++) row[j] = `${j}`;
        matrix.push(row);
      }
      // データ自体をFreezeしてメモリ効率を上げる
      resolve(Object.freeze(matrix) as string[][]);
    }, 1000);
  });
};

const queryClient = new QueryClient();

// --- 2. メインコンポーネント ---
export default function DataTableV8() {
  return (
    <QueryClientProvider client={queryClient}>
      <HeavyGrid />
    </QueryClientProvider>
  );
}

function HeavyGrid() {
  const parentRef = useRef<HTMLDivElement>(null);

  // --- 3. useQuery の設定 (ここが重要) ---
  const { data, isPending, error } = useQuery({
    queryKey: ["huge-matrix"],
    queryFn: fetchAllData,

    // 【必須】巨大データでのフリーズを防ぐ設定
    structuralSharing: false,

    // 【推奨】頻繁な再取得を防ぐ (一度取ったら破棄されるまでキャッシュを使う)
    staleTime: Infinity,

    // 【推奨】メモリ管理 (画面を離れて5分経ったらメモリから消す)
    gcTime: 1000 * 60 * 5,

    // 【推奨】ウィンドウフォーカス時の自動再取得をOFF (巨大すぎて重いため)
    refetchOnWindowFocus: false,
  });

  // --- 仮想化のセットアップ (データがある場合のみ) ---
  const rowVirtualizer = useVirtualizer({
    count: data?.length ?? 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 5,
  });

  const columnVirtualizer = useVirtualizer({
    count: data?.[0]?.length ?? 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    horizontal: true,
    overscan: 2,
  });

  if (isPending) {
    return <div style={{ padding: 20 }}>Loading 20 million cells...</div>;
  }

  if (error) {
    return <div style={{ color: "red" }}>Error loading data</div>;
  }

  // 以下、描画ロジックは前回と同じ
  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualCols = columnVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();
  const totalWidth = columnVirtualizer.getTotalSize();
  const paddingTop = virtualRows[0]?.start ?? 0;
  const paddingLeft = virtualCols[0]?.start ?? 0;

  return (
    <div style={{ padding: "20px" }}>
      <h2>useQuery with 100k Rows / 200 Cols</h2>
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
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              transform: `translate(${paddingLeft}px, ${paddingTop}px)`,
              display: "grid",
              gridTemplateColumns: `repeat(${virtualCols.length}, 80px)`,
              gridTemplateRows: `repeat(${virtualRows.length}, 35px)`,
            }}
          >
            {virtualRows.map((virtualRow) => {
              const row = data[virtualRow.index];
              return (
                <React.Fragment key={virtualRow.key}>
                  {virtualCols.map((virtualCol) => (
                    <div
                      key={`${virtualRow.key}-${virtualCol.key}`}
                      style={{
                        borderRight: "1px solid #eee",
                        borderBottom: "1px solid #eee",
                        display: "flex",
                        alignItems: "center",
                        padding: "0 4px",
                        fontSize: "0.8rem",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        background: virtualRow.index % 2 ? "#f9f9f9" : "#fff",
                      }}
                    >
                      {row[virtualCol.index]}
                    </div>
                  ))}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
