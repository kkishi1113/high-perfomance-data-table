import React, { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

// --- 設定 ---
const ROW_COUNT = 100000; // 10万行
const COL_COUNT = 200; // 200列

export default function UltraHeavyGrid() {
  const parentRef = useRef<HTMLDivElement>(null);

  // 1. 行（縦）の仮想化
  const rowVirtualizer = useVirtualizer({
    count: ROW_COUNT,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35, // 行の高さ 35px
    overscan: 5,
  });

  // 2. 列（横）の仮想化
  const columnVirtualizer = useVirtualizer({
    count: COL_COUNT,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // 列の幅 100px
    horizontal: true,
    overscan: 5,
  });

  // 3. 仮想アイテムの取得
  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualCols = columnVirtualizer.getVirtualItems();

  // 4. スクロール範囲の計算
  // データが存在しないため、仮想化ライブラリが計算した「本来あるはずのサイズ」を使います
  const totalHeight = rowVirtualizer.getTotalSize();
  const totalWidth = columnVirtualizer.getTotalSize();

  // 仮想パディング（余白）の計算
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start || 0 : 0;
  const paddingLeft = virtualCols.length > 0 ? virtualCols[0].start || 0 : 0;

  return (
    <div style={{ padding: "20px" }}>
      <h2>Ultra Large Grid (Memory Optimized)</h2>
      <p style={{ color: "#666" }}>
        100,000 rows x 200 columns (20M cells).
        <br />
        Data is generated on-the-fly (JIT) to prevent memory crash.
      </p>

      <div
        ref={parentRef}
        style={{
          height: "600px",
          width: "100%",
          overflow: "auto",
          border: "1px solid #ccc",
          position: "relative",
          background: "#fff",
        }}
      >
        <div
          style={{
            height: `${totalHeight}px`,
            width: `${totalWidth}px`,
            position: "relative",
          }}
        >
          {/* ここが重要: 
            絶対配置で個別に置くのではなく、
            「見えている領域」だけを切り取って描画します。
          */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              transform: `translate(${paddingLeft}px, ${paddingTop}px)`,
              display: "grid",
              // 見えている行数・列数だけのGridを作る
              gridTemplateColumns: `repeat(${virtualCols.length}, 100px)`,
              gridTemplateRows: `repeat(${virtualRows.length}, 35px)`,
            }}
          >
            {virtualRows.map((virtualRow) => (
              <React.Fragment key={virtualRow.key}>
                {virtualCols.map((virtualCol) => {
                  // --- ここでセルの値を動的生成 ---
                  // メモリにデータを保存せず、座標(x, y)から値を計算して表示するだけ
                  const cellValue = `R${virtualRow.index} : C${virtualCol.index}`;

                  return (
                    <div
                      key={`${virtualRow.key}-${virtualCol.key}`}
                      style={{
                        borderRight: "1px solid #eee",
                        borderBottom: "1px solid #eee",
                        padding: "0 8px",
                        display: "flex",
                        alignItems: "center",
                        fontSize: "0.85rem",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        backgroundColor:
                          virtualRow.index % 2 === 0 ? "#fff" : "#f9f9f9",
                      }}
                    >
                      {cellValue}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
