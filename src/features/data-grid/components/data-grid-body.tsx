import { memo } from "react";
import { DataGridCell } from "./data-grid-cell";
import { cn } from "@/lib/utils";
import type { DataGridBodyProps } from "../types";
import type { Row } from "@tanstack/react-table";
import type { VirtualItem } from "@tanstack/react-virtual";

import { getCommonPinningStyles } from "../utils/get-common-pinning-style";

/**
 * データグリッドのボディコンポーネント
 * 仮想化された行と列を効率的にレンダリングします。
 * @template T データ型
 */
function DataGridBodyComponent<T>({
  virtualRows,
  virtualCols,
  totalHeight,
  totalWidth,
  rows,
  topRows,
  bottomRows,
  leftColumns,
  rightColumns,
  centerColumns,
  editingCell,
  onEditStart,
  onEditFinish,
  onEditCancel,
  selectedRowIds,
  headerHeight,
  rowHeight,
}: DataGridBodyProps<T>) {
  // メモ化の更新トリガーとして使用（未使用警告を抑制）
  void selectedRowIds;

  // 行レンダリング用ヘルパー関数
  const renderRow = (row: Row<T>, virtualRow?: VirtualItem, isStickyTop = false, isStickyBottom = false) => {
    const visibleCells = row.getVisibleCells();
    // セルをIDでマップ化して高速アクセス
    const cellsMap = new Map(visibleCells.map(c => [c.column.id, c]));

    // ピン留め行のtop位置計算
    // isStickyTopの場合、ヘッダーの高さ + (インデックス * 行の高さ)
    // isStickyBottomの場合、bottom: 0 (複数行の場合は積み上げが必要だが、簡易実装として0固定または別途計算が必要)
    // ここでは簡易的に、bottom固定行は積み上げを考慮せず、top固定行のみ修正対象とする

    // Note: topRowsのインデックスは0から始まる
    // 実際のインデックスは row.index だが、これは全データ中のインデックス。
    // topRows内のインデックスが必要。
    const topIndex = topRows.findIndex(r => r.id === row.id);

    let topStyle: number | undefined = undefined;
    let bottomStyle: number | undefined = undefined;

    if (isStickyTop) {
      topStyle = headerHeight + (topIndex >= 0 ? topIndex * rowHeight : 0);
    } else if (isStickyBottom) {
      // bottomRows内のインデックスを取得
      const bottomIndex = bottomRows.findIndex(r => r.id === row.id);
      // 下から積み上げる: (総数 - 1 - インデックス) * 高さ
      if (bottomIndex >= 0) {
        bottomStyle = (bottomRows.length - 1 - bottomIndex) * rowHeight;
      } else {
        bottomStyle = 0;
      }
    } else {
      topStyle = virtualRow?.start;
    }

    return (
      <div
        key={row.id}
        className={cn(
          "flex items-center border-b bg-white hover:bg-gray-50 transition-colors box-border",
          row.getIsSelected() && "bg-blue-50 hover:bg-blue-100",
          (isStickyTop || isStickyBottom) ? "sticky z-10 bg-gray-100" : "absolute left-0"
        )}
        style={{
          top: topStyle,
          bottom: bottomStyle,
          height: rowHeight, // 固定行の高さ
          width: "100%",
          minWidth: "fit-content", // コンテンツ幅に合わせる
        }}
        onClick={() => row.toggleSelected()}
      >
        {/* Left Pinned Cells */}
        {leftColumns.map((column) => {
          const cell = cellsMap.get(column.id);
          if (!cell) return null;
          return (
            <div
              key={cell.id}
              className={cn(
                "flex items-center border-r bg-inherit h-full",
                cell.column.getIsResizing() && "border-r-2 border-blue-500"
              )}
              style={{
                ...getCommonPinningStyles(column),
              }}
            >
              <DataGridCell
                cell={cell}
                isEditing={
                  editingCell?.rowIndex === row.index &&
                  editingCell?.colId === column.id
                }
                onEditStart={() => onEditStart(row.index, column.id)}
                onEditFinish={(value) =>
                  onEditFinish(row.index, column.id, value)
                }
                onEditCancel={onEditCancel}
              />
            </div>
          );
        })}

        {/* Virtualized Center Cells */}
        <div className="relative flex-1 h-full">
          {virtualCols.map((virtualCol) => {
            const col = centerColumns[virtualCol.index];
            const cell = cellsMap.get(col.id);
            if (!cell) return null;
            return (
              <div
                key={cell.id}
                className={cn(
                  "flex items-center border-r last:border-r-0 absolute top-0 h-full",
                  cell.column.getIsResizing() && "border-r-2 border-blue-500"
                )}
                style={{
                  left: virtualCol.start,
                  width: virtualCol.size,
                }}
              >
                <DataGridCell
                  cell={cell}
                  isEditing={
                    editingCell?.rowIndex === row.index &&
                    editingCell?.colId === col.id
                  }
                  onEditStart={() => onEditStart(row.index, col.id)}
                  onEditFinish={(value) =>
                    onEditFinish(row.index, col.id, value)
                  }
                  onEditCancel={onEditCancel}
                />
              </div>
            );
          })}
        </div>

        {/* Right Pinned Cells */}
        {rightColumns.map((column) => {
          const cell = cellsMap.get(column.id);
          if (!cell) return null;
          return (
            <div
              key={cell.id}
              className={cn(
                "flex items-center border-l bg-inherit h-full",
                cell.column.getIsResizing() && "border-r-2 border-blue-500"
              )}
              style={{
                ...getCommonPinningStyles(column),
              }}
            >
              <DataGridCell
                cell={cell}
                isEditing={
                  editingCell?.rowIndex === row.index &&
                  editingCell?.colId === column.id
                }
                onEditStart={() => onEditStart(row.index, column.id)}
                onEditFinish={(value) =>
                  onEditFinish(row.index, column.id, value)
                }
                onEditCancel={onEditCancel}
              />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className="relative w-full flex flex-col"
      style={{
        height: totalHeight, // 仮想化領域の高さ
        width: totalWidth, // 仮想化領域の幅（ただし固定列があるため調整が必要かも）
        minWidth: "100%",
      }}
    >
      {/* Top Pinned Rows */}
      {topRows.map(row => renderRow(row, undefined, true))}

      {/* Virtualized Rows */}
      {virtualRows.map((virtualRow) => {
        const row = rows[virtualRow.index];
        if (!row) return null;
        return renderRow(row, virtualRow);
      })}

      {/* Bottom Pinned Rows */}
      {bottomRows.map(row => renderRow(row, undefined, false, true))}
    </div>
  );
}

export const DataGridBody = memo(DataGridBodyComponent) as typeof DataGridBodyComponent;

