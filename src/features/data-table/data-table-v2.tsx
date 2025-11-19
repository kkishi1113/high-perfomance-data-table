import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

// 1. 10万件のダミーデータ生成
const rowData = Array.from({ length: 100000 }, (_, i) => ({
  id: i,
  name: `User ${i}`,
  email: `user${i}@example.com`,
  role: i % 3 === 0 ? "Admin" : "User",
}));

export const VirtualTableV2 = () => {
  // スクロールコンテナの参照
  const parentRef = useRef<HTMLDivElement>(null);

  // 2. Virtualizerの設定
  const rowVirtualizer = useVirtualizer({
    count: rowData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35, // 行の高さ（px）の目安
    overscan: 5, // スクロール時のチラつき防止のために、画面外に余分に描画する行数
  });

  return (
    <div
      ref={parentRef}
      style={{
        height: "500px", // 表示領域の高さ
        overflow: "auto", // スクロール可能にする
        border: "1px solid #ccc",
      }}
    >
      <div
        style={{
          // 全データの推定高さ（これでスクロールバーの長さを確保）
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {/* 3. 現在見えているアイテムだけをマップして描画 */}
        {rowVirtualizer.getVirtualItems().map((virtualItem) => {
          const user = rowData[virtualItem.index];
          return (
            <div
              key={virtualItem.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`, // 表示位置の調整
                display: "flex",
                alignItems: "center",
                padding: "0 10px",
                background: virtualItem.index % 2 ? "#f9f9f9" : "#fff",
              }}
            >
              <div style={{ width: "10%" }}>{user.id}</div>
              <div style={{ width: "30%" }}>{user.name}</div>
              <div style={{ width: "40%" }}>{user.email}</div>
              <div style={{ width: "20%" }}>{user.role}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
