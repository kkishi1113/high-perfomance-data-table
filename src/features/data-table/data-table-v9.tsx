import { useRef } from "react";
import {
  useQuery,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";

// --- 1. データ取得 (前回と同じ) ---
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
        for (let j = 2; j < cols; j++) row[j] = `${j}`;
        matrix.push(row);
      }
      resolve(Object.freeze(matrix) as string[][]);
    }, 1000);
  });
};

const queryClient = new QueryClient();

// --- 2. スタイル定義 (shadcn/uiのソースコードから抽出) ---
// これをdivに適用することで、見た目を完全にTableコンポーネントに偽装します
const styles = {
  tableWrapper: "relative w-full overflow-auto border rounded-md", // 外枠と角丸
  headerRow:
    "flex border-b bg-muted/50 sticky top-0 z-10 font-medium text-muted-foreground", // ヘッダー
  bodyRow:
    "flex border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted", // 行（ホバー効果あり）
  cell: "flex items-center px-4 text-sm align-middle h-full", // セル（文字サイズ、配置）
};

export default function DataTableV9() {
  return (
    <QueryClientProvider client={queryClient}>
      <ShadcnVirtualGrid />
    </QueryClientProvider>
  );
}

function ShadcnVirtualGrid() {
  const parentRef = useRef<HTMLDivElement>(null);

  const { data, isPending } = useQuery({
    queryKey: ["huge-matrix"],
    queryFn: fetchAllData,
    structuralSharing: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const rowVirtualizer = useVirtualizer({
    count: data?.length ?? 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 45, // shadcnの標準的な行の高さに合わせる
    overscan: 5,
  });

  const columnVirtualizer = useVirtualizer({
    count: data?.[0]?.length ?? 0,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (index === 1 ? 200 : 100), // 特定の列幅を変える例
    horizontal: true,
    overscan: 2,
  });

  if (isPending) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        <div className="animate-spin mr-2 h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
        Loading data...
      </div>
    );
  }

  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualCols = columnVirtualizer.getVirtualItems();

  // 全体のサイズ
  const totalHeight = rowVirtualizer.getTotalSize();
  const totalWidth = columnVirtualizer.getTotalSize();

  // ヘッダー用の仮想カラム（横スクロール連動のため）
  // ※ヘッダーも横仮想化しないと、スクロールした時にヘッダーだけ置いていかれます
  //   const headerVirtualCols = virtualCols;

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold tracking-tight mb-4">
        Shadcn UI Look-alike Virtual Table
      </h2>

      {/* Table Wrapper */}
      <div
        ref={parentRef}
        className={styles.tableWrapper} // border rounded-md
        style={{ height: "600px", width: "100%" }}
      >
        <div
          style={{
            height: `${totalHeight}px`,
            width: `${totalWidth}px`,
            position: "relative",
          }}
        >
          {/* Header (Sticky)
            絶対配置ではなくStickyを使うことで、縦スクロール時は固定、横スクロール時は追従させます
          */}
          <div
            className={styles.headerRow}
            style={{
              width: `${totalWidth}px`, // 全幅を指定
              height: "40px", // ヘッダーの高さ
              display: "flex",
            }}
          >
            {/* 左側の仮想パディング（横スクロール用） */}
            <div
              style={{
                width: `${virtualCols[0]?.start ?? 0}px`,
                flexShrink: 0,
              }}
            />

            {/* ヘッダーセル */}
            {virtualCols.map((vc) => (
              <div
                key={vc.key}
                className={styles.cell}
                style={{ width: `${vc.size}px` }}
              >
                {vc.index === 0
                  ? "ID"
                  : vc.index === 1
                  ? "Name"
                  : `Col ${vc.index}`}
              </div>
            ))}
          </div>

          {/* Body Rows */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              // ヘッダーの高さ分ずらす
              transform: `translateY(${virtualRows[0]?.start ?? 0}px)`,
              width: "100%",
            }}
          >
            {/* ヘッダー分のオフセット用div 
               (virtualRowsのstartは0から始まるため、ヘッダーとかぶらないようにmarginなどで調整が必要な場合がありますが、
                今回はabsolute配置のY座標で制御しています)
            */}

            {virtualRows.map((virtualRow) => {
              const row = data![virtualRow.index];
              return (
                <div
                  key={virtualRow.key}
                  className={styles.bodyRow} // hover効果などのshadcnスタイル
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${
                      virtualRow.start - (virtualRows[0]?.start ?? 0)
                    }px)`,
                    position: "absolute", // 行を絶対配置
                    top: "40px", // ヘッダーの高さ分下げる
                    left: 0,
                    width: `${totalWidth}px`,
                  }}
                >
                  {/* 左側の仮想パディング */}
                  <div
                    style={{
                      width: `${virtualCols[0]?.start ?? 0}px`,
                      flexShrink: 0,
                    }}
                  />

                  {/* データセル */}
                  {virtualCols.map((vc) => (
                    <div
                      key={vc.key}
                      className={styles.cell} // px-4 align-middle など
                      style={{ width: `${vc.size}px` }}
                    >
                      {row[vc.index]}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground mt-2">
        {data?.length.toLocaleString()} rows x {data?.[0].length} columns
      </div>
    </div>
  );
}
