import { memo } from "react";
import type { Row } from "@tanstack/react-table";
import type { VirtualItem } from "@tanstack/react-virtual";
import { DataGridCell } from "./data-grid-cell";
import { cn } from "@/lib/utils";

/**
 * DataGridBodyコンポーネントのProps
 * @template T データ型
 */
type DataGridBodyProps<T> = {
  /** 仮想化された行のリスト */
  virtualRows: VirtualItem[];
  /** 仮想化された列のリスト */
  virtualCols: VirtualItem[];
  /** 全体の高さ（ピクセル） */
  totalHeight: number;
  /** 全体の幅（ピクセル） */
  totalWidth: number;
  /** 表示する行データ */
  rows: Row<T>[];
  /** 現在編集中のセル情報 */
  editingCell: { rowIndex: number; colId: string } | null;
  /** 編集開始時のコールバック */
  onEditStart: (rowIndex: number, colId: string) => void;
  /** 編集完了時のコールバック */
  onEditFinish: (rowIndex: number, colId: string, value: any) => void;
  /** 編集キャンセル時のコールバック */
  onEditCancel: () => void;
  /** 選択された行のIDマップ */
  selectedRowIds: Record<string, boolean>;
};

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
  editingCell,
  onEditStart,
  onEditFinish,
  onEditCancel,
  selectedRowIds,
}: DataGridBodyProps<T>) {
  // メモ化の更新トリガーとして使用（未使用警告を抑制）
  void selectedRowIds;
  return (
    <div
      className="relative w-full"
      style={{
        height: totalHeight,
        width: totalWidth,
      }}
    >
      {virtualRows.map((virtualRow) => {
        const row = rows[virtualRow.index];
        if (!row) return null;
        const visibleCells = row.getVisibleCells();

        return (
          <div
            key={row.id}
            className={cn(
              "absolute left-0 flex items-center border-b hover:bg-gray-50 transition-colors",
              row.getIsSelected() && "bg-blue-50 hover:bg-blue-100"
            )}
            style={{
              top: virtualRow.start,
              height: virtualRow.size,
              width: totalWidth,
            }}
            onClick={() => row.toggleSelected()}
          >
            {virtualCols.map((virtualCol) => {
              const cell = visibleCells[virtualCol.index];
              if (!cell) return null;

              const isEditing =
                editingCell?.rowIndex === virtualRow.index &&
                editingCell?.colId === cell.column.id;

              return (
                <div
                  key={cell.id}
                  className="absolute top-0 h-full border-r last:border-r-0"
                  style={{
                    left: virtualCol.start,
                    width: virtualCol.size,
                  }}
                >
                  <DataGridCell
                    cell={cell}
                    isEditing={isEditing}
                    onEditStart={() =>
                      onEditStart(virtualRow.index, cell.column.id)
                    }
                    onEditFinish={(val) =>
                      onEditFinish(virtualRow.index, cell.column.id, val)
                    }
                    onEditCancel={onEditCancel}
                  />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export const DataGridBody = memo(DataGridBodyComponent) as typeof DataGridBodyComponent;

