import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { createWorker } from "./worker-factory";
import { DataGridBody } from "./data-grid-body";
import { DataGridHeader } from "./data-grid-header";
import { cn } from "@/lib/utils";
import type { DataGridProps, WorkerResponse } from "./types";

/**
 * 高性能データグリッドコンポーネント
 * 仮想化、ソート、編集、カラムリサイズ、行選択機能を提供します。
 *
 * @template T データ型（Recordを継承）
 * @param props DataGridProps
 * @returns データグリッドコンポーネント
 */
export function DataGrid<T extends Record<string, any>>({
  columns,
  data,
  rowHeight = 34,
  headerHeight = 40,
  estimatedColumnWidth = 120,
  className,
  style,
  onDataChange,
  enableRowSelection = true,
  enableColumnResizing = true,
  enableSorting = true,
}: DataGridProps<T>) {
  // --- 状態管理 ---
  const [rows, setRows] = useState<T[]>(() => data);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // --- Web Worker関連 ---
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const rowsRef = useRef(rows);

  useEffect(() => {
    rowsRef.current = rows;
  });

  useEffect(() => {
    setRows(data);
  }, [data]);

  useEffect(() => {
    workerRef.current = createWorker();
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  /**
   * Web Workerにメッセージを送信し、結果を待つヘルパー関数
   * @param op 操作名（例: 'sort', 'filter'）
   * @param payload 操作に必要なデータ
   * @returns Workerからの結果
   */
  const postWorker = useCallback((op: string, payload: any) => {
    return new Promise<any>((resolve, reject) => {
      const id = ++requestIdRef.current;
      const w = workerRef.current;
      if (!w) return resolve(null);

      const handler = (e: MessageEvent<WorkerResponse>) => {
        if (e.data.id !== id) return;
        w.removeEventListener("message", handler);
        if ("error" in e.data) {
          reject(new Error(e.data.error));
        } else {
          resolve(e.data.result);
        }
      };
      w.addEventListener("message", handler);
      w.postMessage({ id, op, payload });
    });
  }, []);

  // --- ソート処理（Web Worker使用） ---
  useEffect(() => {
    if (sorting.length === 0) {
      // ソートがない場合、元のデータ順序にリセットしたい場合があります
      // 現時点では、dataプロパティが変更されるとリセットされます
      // ソートをクリアした場合、データを行に再適用して順序をリセットする必要があるかもしれません
      // ただし、行が現在データと異なる場合のみ（ソート済みの可能性がある）
      // 簡単なチェック:
      if (data !== rows) {
        // ソートをクリアする際、元の順序（data）に戻したいが、
        // 行に加えられた編集（rowsRef.current）は保持したい
        // 行には一意の'id'プロパティがあると仮定します
        const currentRowsMap = new Map(
          rowsRef.current.map((r: any) => [r.id, r])
        );

        const mergedRows = data.map((originalRow: any) => {
          // 行が現在の状態に存在する場合（編集されている可能性がある）、それを使用
          // そうでなければ元のデータにフォールバック
          // 注: これは'id'が存在し、安定していることに依存します
          if (
            originalRow.id !== undefined &&
            currentRowsMap.has(originalRow.id)
          ) {
            return currentRowsMap.get(originalRow.id)!;
          }
          return originalRow;
        });

        setRows(mergedRows);
      }
      return;
    }

    const runSort = async () => {
      // 最適化: データが変更されておらず、ソートも変更されていない場合はソートしない
      // ただし、ここではuseEffect [sorting, data]内にいるので問題ありません

      // ソート時に編集を保持するためにrowsRef.currentを使用
      // ただし、dataプロパティが最近変更された場合は、それを使用する必要があります
      // しかし、setRows(data)エフェクトがdataプロパティの変更を処理します
      // したがって、ここでは現在のものをソートするだけです
      const sorted = await postWorker("sort", {
        rows: rowsRef.current,
        sortBy: sorting,
      });
      if (sorted) setRows(sorted);
    };
    runSort();
  }, [sorting, postWorker]); // 競合/レースを避けるためにdataを依存関係から削除、setRows(data)エフェクトで処理

  // --- テーブル定義 ---
  const tableColumns = useMemo<ColumnDef<T>[]>(
    () =>
      columns.map((col) => ({
        accessorKey: col.accessorKey,
        header: col.header,
        size: col.width ?? estimatedColumnWidth,
        minSize: col.minWidth ?? 50,
        maxSize: col.maxWidth ?? 500,
        enableResizing: col.enableResizing ?? enableColumnResizing,
        enableSorting: col.enableSorting ?? enableSorting,
        cell: (info) => info.getValue(),
      })),
    [columns, estimatedColumnWidth, enableColumnResizing, enableSorting]
  );

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    state: {
      sorting,
      rowSelection,
      columnFilters,
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
    enableRowSelection,
    enableColumnResizing, // テーブルオプションに渡すことを確認
  });

  // --- 仮想化 ---
  const parentRef = useRef<HTMLDivElement>(null);

  const { rows: tableRows } = table.getRowModel();
  const visibleColumns = table.getVisibleLeafColumns();
  const { columnSizing } = table.getState();

  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
    scrollMargin: headerHeight, // ヘッダーの高さを考慮してオフセットを設定
  });

  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: visibleColumns.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => visibleColumns[i].getSize(),
    overscan: 2,
    lanes: columnSizing ? undefined : undefined, // 再レンダリングに依存
  });

  // カラムサイズ変更時に仮想化を強制更新
  useEffect(() => {
    columnVirtualizer.measure();
  }, [columnSizing, columnVirtualizer]);

  // --- 編集機能 ---
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    colId: string;
  } | null>(null);

  const handleEditFinish = useCallback(
    (rowIndex: number, colId: string, value: any) => {
      setRows((prev) => {
        const next = [...prev];
        const row = next[rowIndex];
        const colDef = columns.find(
          (c) => c.id === colId || c.accessorKey === colId
        );
        const key = colDef?.accessorKey || colId;

        next[rowIndex] = { ...row, [key]: value };
        onDataChange?.(next);
        return next;
      });
      setEditingCell(null);
    },
    [columns, onDataChange]
  );

  // --- レンダリング ---
  return (
    <div
      ref={parentRef}
      className={cn(
        "flex flex-col border rounded-md overflow-auto bg-white relative",
        className
      )}
      style={style}
    >
      {/* コンテンツ全体を内包するdiv。幅と高さを仮想化サイズに設定 */}
      <div
        style={{
          width: columnVirtualizer.getTotalSize(),
          height: rowVirtualizer.getTotalSize() + headerHeight,
          position: "relative",
        }}
      >
        {/* Header */}
        <div
          className="flex border-b bg-gray-50 sticky top-0 z-10"
          style={{
            width: "100%", // コンテナ幅に合わせる
            height: headerHeight,
          }}
        >
          {columnVirtualizer.getVirtualItems().map((virtualCol) => {
            const header = table.getFlatHeaders()[virtualCol.index];
            return (
              <DataGridHeader
                key={header.id}
                header={header}
                style={{
                  width: virtualCol.size,
                  transform: `translateX(${virtualCol.start}px)`,
                  position: "absolute",
                  left: 0,
                }}
              />
            );
          })}
        </div>

        {/* Body */}
        <DataGridBody
          virtualRows={rowVirtualizer.getVirtualItems()}
          virtualCols={columnVirtualizer.getVirtualItems()}
          totalHeight={rowVirtualizer.getTotalSize()}
          totalWidth={columnVirtualizer.getTotalSize()}
          rows={tableRows}
          editingCell={editingCell}
          onEditStart={useCallback(
            (rowIndex, colId) => setEditingCell({ rowIndex, colId }),
            []
          )}
          onEditFinish={handleEditFinish}
          onEditCancel={useCallback(() => setEditingCell(null), [])}
          selectedRowIds={rowSelection}
        />
      </div>
    </div>
  );
}
