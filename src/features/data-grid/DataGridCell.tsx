import React, { useState, useEffect, useRef, memo } from "react";
import type { Cell } from "@tanstack/react-table";
import { cn } from "@/lib/utils";

type DataGridCellProps<T> = {
  cell: Cell<T, unknown>;
  isEditing: boolean;
  onEditStart: () => void;
  onEditFinish: (value: any) => void;
  onEditCancel: () => void;
  className?: string;
  style?: React.CSSProperties;
};

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

  useEffect(() => {
    setValue(cell.getValue());
  }, [cell.getValue()]);

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
      setValue(cell.getValue()); // Reset
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

export const DataGridCell = memo(DataGridCellComponent, (prev, next) => {
  // Only re-render if:
  // 1. The cell value changed
  // 2. The editing state for this cell changed
  // 3. Style changed (e.g. width)
  
  const prevVal = prev.cell.getValue();
  const nextVal = next.cell.getValue();
  
  if (prevVal !== nextVal) return false;
  if (prev.isEditing !== next.isEditing) return false;
  
  // Check style width (virtualization updates this)
  if (prev.style?.width !== next.style?.width) return false;
  if (prev.style?.left !== next.style?.left) return false;

  return true;
}) as typeof DataGridCellComponent;

