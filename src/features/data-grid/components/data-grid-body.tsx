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
}: DataGridBodyProps<T>) {
  // メモ化の更新トリガーとして使用（未使用警告を抑制）
  void selectedRowIds;

  // 行レンダリング用ヘルパー関数
  const renderRow = (row: Row<T>, virtualRow?: VirtualItem, isStickyTop = false, isStickyBottom = false) => {
    const visibleCells = row.getVisibleCells();
    // セルをIDでマップ化して高速アクセス
    const cellsMap = new Map(visibleCells.map(c => [c.column.id, c]));

    return (
      <div
        key={row.id}
        className={cn(
          "flex items-center border-b bg-white hover:bg-gray-50 transition-colors box-border",
          row.getIsSelected() && "bg-blue-50 hover:bg-blue-100",
          (isStickyTop || isStickyBottom) ? "sticky z-10 bg-gray-100" : "absolute left-0"
        )}
        style={{
          top: isStickyBottom ? undefined : (isStickyTop ? 0 : virtualRow?.start),
          bottom: isStickyBottom ? 0 : undefined,
          height: virtualRow?.size || 34, // 固定行の高さはデフォルトか動的に取得
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

