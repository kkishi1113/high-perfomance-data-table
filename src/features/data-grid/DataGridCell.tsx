import React, { useState, useEffect, useRef } from "react";
import type { Cell } from "@tanstack/react-table";
import { cn } from "@/lib/utils"; // Assuming standard shadcn utils exist, otherwise I'll define a local helper or use clsx directly if needed. Wait, I saw clsx and tailwind-merge in package.json.


type DataGridCellProps<T> = {
  cell: Cell<T, unknown>;
  isEditing: boolean;
  onEditStart: () => void;
  onEditFinish: (value: any) => void;
  onEditCancel: () => void;
  className?: string;
  style?: React.CSSProperties;
};

export function DataGridCell<T>({
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
