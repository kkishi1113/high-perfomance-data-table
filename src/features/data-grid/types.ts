import type { RowData, Header, Cell, Row } from "@tanstack/react-table";
import type { VirtualItem } from "@tanstack/react-virtual";

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
  accessor?: (row: T) => unknown;
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
 * DataGridHeaderコンポーネントのProps
 * @template T データ型
 */
export type DataGridHeaderProps<T> = {
  /** 表示するヘッダーオブジェクト */
  header: Header<T, unknown>;
  /** 追加のクラス名 */
  className?: string;
  /** スタイルオブジェクト */
  style?: React.CSSProperties;
};

/**
 * DataGridCellコンポーネントのProps
 * @template T データ型
 */
export type DataGridCellProps<T> = {
  /** 表示するセルオブジェクト */
  cell: Cell<T, unknown>;
  /** 編集モードかどうか */
  isEditing: boolean;
  /** 編集開始時のコールバック */
  onEditStart: () => void;
  /** 編集完了時のコールバック */
  onEditFinish: (value: unknown) => void;
  /** 編集キャンセル時のコールバック */
  onEditCancel: () => void;
  /** 追加のクラス名 */
  className?: string;
  /** スタイルオブジェクト */
  style?: React.CSSProperties;
};

/**
 * DataGridBodyコンポーネントのProps
 * @template T データ型
 */
export type DataGridBodyProps<T> = {
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
  onEditFinish: (rowIndex: number, colId: string, value: unknown) => void;
  /** 編集キャンセル時のコールバック */
  onEditCancel: () => void;
  /** 選択された行のIDマップ */
  selectedRowIds: Record<string, boolean>;
};

/**
 * Web Workerソート処理のペイロード型
 */
export type WorkerSortPayload = {
  /** ソート対象の行データ配列 */
  rows: Record<string, unknown>[];
  /** ソート条件配列 */
  sortBy: { id: string; desc?: boolean }[];
};

/**
 * Web Workerフィルター処理のペイロード型
 */
export type WorkerFilterPayload = {
  /** フィルター対象の行データ配列 */
  rows: Record<string, unknown>[];
  /** フィルター条件配列 */
  filters: { id: string; value: unknown }[];
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
  | { id: number; result: Record<string, unknown>[] }
  | { id: number; error: string };
