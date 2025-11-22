import React, { useState, useEffect, useRef, memo } from "react";
import { cn } from "@/lib/utils";
import type { DataGridCellProps } from "../types";

/**
 * データグリッドのセルコンポーネント
 * 表示モードと編集モードを切り替えることができます。
 * @template T データ型
 */
function DataGridCellComponent<T>({
  cell,
  isEditing,
  onEditStart,
  onEditFinish,
  onEditCancel,
  className,
  style,
}: DataGridCellProps<T>) {
  const [value, setValue] = useState(cell.getValue());
  const inputRef = useRef<HTMLInputElement>(null);

  // 外部からの値変更を同期
  useEffect(() => {
    setValue(cell.getValue());
  }, [cell.getValue()]);

  // 編集モードに入ったら入力フィールドにフォーカスして選択
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onEditFinish(value);
    } else if (e.key === "Escape") {
      onEditCancel();
      setValue(cell.getValue()); // 元の値に戻す
    }
  };

  const handleBlur = () => {
    onEditFinish(value);
  };

  if (isEditing) {
    return (
      <div className={cn("w-full h-full p-0", className)} style={style}>
        <input
          ref={inputRef}
          value={String(value ?? "")}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="w-full h-full px-2 py-1 outline-none bg-white text-sm"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full h-full px-2 py-1 flex items-center text-sm truncate select-none cursor-default",
        className
      )}
      style={style}
      onDoubleClick={onEditStart}
      title={String(cell.getValue() ?? "")}
    >
      {String(cell.getValue() ?? "")}
    </div>
  );
}

/**
 * メモ化されたDataGridCellコンポーネント
 * 以下の場合のみ再レンダリングされます:
 * 1. セルの値が変更された
 * 2. 編集状態が変更された
 * 3. スタイル（幅や位置）が変更された
 */
export const DataGridCell = memo(DataGridCellComponent, (prev, next) => {
  const prevVal = prev.cell.getValue();
  const nextVal = next.cell.getValue();

  if (prevVal !== nextVal) return false;
  if (prev.isEditing !== next.isEditing) return false;

  // スタイルの幅をチェック（仮想化で更新される）
  if (prev.style?.width !== next.style?.width) return false;
  if (prev.style?.left !== next.style?.left) return false;

  return true;
}) as typeof DataGridCellComponent;
