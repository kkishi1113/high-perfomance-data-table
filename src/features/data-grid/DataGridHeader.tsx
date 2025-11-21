import React from "react";
import { flexRender, type Header } from "@tanstack/react-table";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ArrowDown, ArrowUp } from "lucide-react";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type DataGridHeaderProps<T> = {
  header: Header<T, unknown>;
  className?: string;
  style?: React.CSSProperties;
};

export function DataGridHeader<T>({
  header,
  className,
  style,
}: DataGridHeaderProps<T>) {
  const { column } = header;
  const isSorted = column.getIsSorted();

  return (
    <div
      className={cn(
        "flex items-center px-2 py-1 border-r bg-gray-50 text-sm font-medium relative group select-none",
        className
      )}
      style={{
        ...style,
        width: header.getSize(),
      }}
    >
      <div
        className="flex-1 flex items-center gap-1 cursor-pointer overflow-hidden"
        onClick={column.getToggleSortingHandler()}
      >
        <span className="truncate">
          {flexRender(column.columnDef.header, header.getContext())}
        </span>
        {isSorted === "asc" && <ArrowUp className="w-3 h-3" />}
        {isSorted === "desc" && <ArrowDown className="w-3 h-3" />}
      </div>

      {/* Resizer */}
      <div
        onMouseDown={header.getResizeHandler()}
        onTouchStart={header.getResizeHandler()}
        className={cn(
          "absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none hover:bg-blue-400 opacity-0 group-hover:opacity-100 transition-opacity z-20",
          header.column.getIsResizing() && "bg-blue-500 opacity-100 w-1.5"
        )}
      />
    </div>
  );
}
