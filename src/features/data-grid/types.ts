import type { RowData } from "@tanstack/react-table";

export type ColumnDefSimple<T> = {
  id: string;
  header: string;
  accessor?: (row: T) => any;
  accessorKey?: keyof T & string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  enableResizing?: boolean;
  enableSorting?: boolean;
  enablePinning?: boolean;
};

export type DataGridProps<T extends RowData> = {
  columns: ColumnDefSimple<T>[];
  data: T[];
  rowHeight?: number;
  headerHeight?: number;
  estimatedColumnWidth?: number;
  className?: string;
  style?: React.CSSProperties;
  onDataChange?: (rows: T[]) => void;
  enableRowSelection?: boolean;
  enableColumnReorder?: boolean;
  enableColumnResizing?: boolean;
  enableSorting?: boolean;
  enableFiltering?: boolean;
};

export type WorkerSortPayload = {
  rows: any[];
  sortBy: { id: string; desc?: boolean }[];
};

export type WorkerFilterPayload = {
  rows: any[];
  filters: { id: string; value: any }[];
};

export type WorkerMessage = 
  | { id: number; op: 'sort'; payload: WorkerSortPayload }
  | { id: number; op: 'filter'; payload: WorkerFilterPayload };

export type WorkerResponse = 
  | { id: number; result: any[] }
  | { id: number; error: string };
