import React, { useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

// --- 1. 巨大データの一括取得をシミュレートするAPI ---
// 実際には fetch('/api/huge-data') で取得したJSONを想定
// データ構造: オブジェクトの配列ではなく、「配列の配列」を使うのが鉄則
type MatrixData = string[][]; // [ ["row1-col1", "row1-col2"...], ["row2-col1"...] ]

const fetchAllDataOnce = async (): Promise<MatrixData> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // 10万行 x 200列 の配列を生成 (約2,000万要素)
      // ※実務ではAPIからこの形式([][])で返してもらうのがベストです
      const rows = 100000;
      const cols = 200;
      const matrix: string[][] = [];

      // メモリ効率のため、文字列はできるだけ短く単純なものを生成
      for (let i = 0; i < rows; i++) {
        const rowArray = new Array(cols);
        // 先頭数列だけ識別用に情報を入れる
        rowArray[0] = String(i); // ID
        rowArray[1] = `User ${i}`; // Name

        // 残りはダミー
        for (let j = 2; j < cols; j++) {
          rowArray[j] = `${j}`;
        }
        matrix.push(rowArray);
      }

      // Object.freezeでV8エンジンの最適化を促し、誤って書き換えるのを防ぐ
      resolve(Object.freeze(matrix) as string[][]);
    }, 1500); // ネットワーク遅延 + パース時間
  });
};

export default function HugeMatrixGrid() {
  // 2. ステート管理
  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const parentRef = useRef<HTMLDivElement>(null);

  // 3. 初回マウント時に全データを取得
  useEffect(() => {
    const load = async () => {
      try {
        const result = await fetchAllDataOnce();
        setData(result);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // --- 4. 仮想化の設定 (データロード後に実行) ---

  // 行の仮想化
  const rowVirtualizer = useVirtualizer({
    count: data?.length || 0, // 100,000
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35, // 行の高さ
    overscan: 5,
  });

  // 列の仮想化
  const columnVirtualizer = useVirtualizer({
    count: data?.at(0)?.length || 0, // 200
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // 列の幅
    horizontal: true,
    overscan: 2,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualCols = columnVirtualizer.getVirtualItems();

  // スクロール領域の計算
  const totalHeight = rowVirtualizer.getTotalSize();
  const totalWidth = columnVirtualizer.getTotalSize();

  // 仮想パディング（表示位置の調整）
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start || 0 : 0;
  const paddingLeft = virtualCols.length > 0 ? virtualCols[0].start || 0 : 0;

  // データロード中はLoading表示
  if (loading || !data) {
    return (
      <div
        style={{
          height: "600px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <div
          className="spinner"
          style={{
            width: "40px",
            height: "40px",
            border: "4px solid #f3f3f3",
            borderTop: "4px solid #3498db",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />
        <p>Fetching & Parsing 20 Million Cells...</p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      <h2>1 Request / 100k Rows / 200 Cols</h2>
      <p style={{ fontSize: "0.9rem", color: "#666" }}>
        Data format: <code>Array&lt;Array&lt;string&gt;&gt;</code> (Matrix) for
        memory efficiency.
      </p>

      <div
        ref={parentRef}
        style={{
          height: "600px",
          width: "100%",
          overflow: "auto",
          border: "1px solid #ccc",
          position: "relative",
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
              // 見えている列数 x 行数 のグリッドを作成
              gridTemplateColumns: `repeat(${virtualCols.length}, 80px)`,
              gridTemplateRows: `repeat(${virtualRows.length}, 35px)`,
            }}
          >
            {virtualRows.map((virtualRow) => {
              // 対象行のデータ配列を取得 (O(1)アクセス)
              const rowArray = data[virtualRow.index];

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
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        backgroundColor:
                          virtualRow.index % 2 === 0 ? "#fff" : "#f9f9f9",
                      }}
                    >
                      {/* 列インデックスを使って直接アクセス
                        data[rowIndex][colIndex] 
                      */}
                      {rowArray[virtualCol.index]}
                    </div>
                  ))}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ marginTop: "10px", fontSize: "0.8rem", color: "#888" }}>
        Memory Usage Note: This loads ~200MB of raw data into browser RAM.
      </div>
    </div>
  );
}
