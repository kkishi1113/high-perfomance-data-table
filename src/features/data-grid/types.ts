import type { RowData } from "@tanstack/react-table";

/**
 * 簡易的なカラム定義型
 * @template T データ型
 */
export type ColumnDefSimple<T> = {
  /** カラムID */
  id: string;
  /** ヘッダー表示名 */
  header: string;
  /** データアクセサ関数 */
  accessor?: (row: T) => any;
  /** データアクセサキー */
  accessorKey?: keyof T & string;
  /** 幅（ピクセル） */
  width?: number;
  /** 最小幅（ピクセル） */
  minWidth?: number;
  /** 最大幅（ピクセル） */
  maxWidth?: number;
  /** リサイズ可能かどうか */
  enableResizing?: boolean;
  /** ソート可能かどうか */
  enableSorting?: boolean;
  /** 固定表示可能かどうか */
  enablePinning?: boolean;
};

/**
 * DataGridコンポーネントのProps
 * @template T データ型（RowDataを継承）
 */
export type DataGridProps<T extends RowData> = {
  /** カラム定義配列 */
  columns: ColumnDefSimple<T>[];
  /** 表示するデータ配列 */
  data: T[];
  /** 行の高さ（ピクセル） @default 34 */
  rowHeight?: number;
  /** ヘッダーの高さ（ピクセル） @default 40 */
  headerHeight?: number;
  /** カラムの推定幅（ピクセル） @default 120 */
  estimatedColumnWidth?: number;
  /** コンテナのクラス名 */
  className?: string;
  /** コンテナのスタイルオブジェクト */
  style?: React.CSSProperties;
  /** データ変更時のコールバック関数 */
  onDataChange?: (rows: T[]) => void;
  /** 行選択を有効にするかどうか @default true */
  enableRowSelection?: boolean;
  /** カラムの並び替えを有効にするかどうか */
  enableColumnReorder?: boolean;
  /** カラムリサイズを有効にするかどうか @default true */
  enableColumnResizing?: boolean;
  /** ソートを有効にするかどうか @default true */
  enableSorting?: boolean;
  /** フィルタリングを有効にするかどうか */
  enableFiltering?: boolean;
};

/**
 * Web Workerソート処理のペイロード型
 */
export type WorkerSortPayload = {
  /** ソート対象の行データ配列 */
  rows: any[];
  /** ソート条件配列 */
  sortBy: { id: string; desc?: boolean }[];
};

/**
 * Web Workerフィルター処理のペイロード型
 */
export type WorkerFilterPayload = {
  /** フィルター対象の行データ配列 */
  rows: any[];
  /** フィルター条件配列 */
  filters: { id: string; value: any }[];
};

/**
 * Web Workerへのメッセージ型
 */
export type WorkerMessage = 
  | { id: number; op: 'sort'; payload: WorkerSortPayload }
  | { id: number; op: 'filter'; payload: WorkerFilterPayload };

/**
 * Web Workerからのレスポンス型
 */
export type WorkerResponse = 
  | { id: number; result: any[] }
  | { id: number; error: string };
