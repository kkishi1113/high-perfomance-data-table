import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
  type Header,
  createColumnHelper,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// --- 型定義とダミーデータ生成 ---
type Person = {
  id: number;
  firstName: string;
  lastName: string;
  age: number;
  visits: number;
  status: string;
};

const makeData = (count: number): Person[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    firstName: `First${i}`,
    lastName: `Last${i}`,
    age: Math.floor(Math.random() * 80),
    visits: Math.floor(Math.random() * 1000),
    status: i % 2 === 0 ? "Active" : "Inactive",
  }));
};

// --- ユーティリティ: 高速化のためのDebounce入力コンポーネント ---
// フィルタリング時に一文字打つごとの再計算を防ぎます
function DebouncedInput({
  value: initialValue,
  onChange,
  debounce = 500,
  ...props
}: {
  value: string | number;
  onChange: (value: string | number) => void;
  debounce?: number;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange">) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      onChange(value);
    }, debounce);
    return () => clearTimeout(timeout);
  }, [value, debounce, onChange]);

  return (
    <input
      {...props}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      style={{ width: "100%", fontSize: "0.8rem", padding: "4px" }}
    />
  );
}

// --- ドラッグ可能なヘッダーセル ---
const DraggableTableHeader = ({
  header,
  children,
}: {
  header: Header<Person, unknown>;
  children: React.ReactNode;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: header.column.id });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 1 : 0,
    position: "relative",
    cursor: "grab",
    display: "flex",
    flexDirection: "column",
    padding: "8px",
    borderRight: "1px solid #ddd",
    background: "#f0f0f0",
    width: header.getSize(), // カラムサイズを維持
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
};

// --- メインコンポーネント ---
export default function HeavyTable() {
  // 1. データ生成 (メモ化必須)
  const data = useMemo(() => makeData(100000), []);

  // 2. カラム定義
  const columnHelper = createColumnHelper<Person>();
  const columns = useMemo(
    () => [
      columnHelper.accessor("id", {
        header: () => "ID",
        cell: (info) => info.getValue(),
        size: 80,
      }),
      columnHelper.accessor("firstName", {
        header: () => "First Name",
        cell: (info) => info.getValue(),
        size: 150,
      }),
      columnHelper.accessor("lastName", {
        header: () => "Last Name",
        cell: (info) => info.getValue(),
        size: 150,
      }),
      columnHelper.accessor("age", {
        header: () => "Age",
        cell: (info) => info.getValue(),
        size: 80,
      }),
      columnHelper.accessor("visits", {
        header: () => "Visits",
        cell: (info) => info.getValue(),
        size: 100,
      }),
      columnHelper.accessor("status", {
        header: () => "Status",
        cell: (info) => info.getValue(),
        size: 100,
      }),
    ],
    [columnHelper]
  );

  // 3. Tableの状態管理
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>(
    columns.map((c) => c.accessorKey as string) // 初期順序
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnOrder,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(), // ソート機能有効化
    getFilteredRowModel: getFilteredRowModel(), // フィルタ機能有効化
    debugTable: false,
  });

  // 4. Virtualizationの設定
  const parentRef = useRef<HTMLDivElement>(null);
  const { rows } = table.getRowModel(); // フィルタ・ソート済みの行を取得

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35, // 1行の高さ
    overscan: 10,
  });

  // 5. ドラッグ＆ドロップのイベントハンドラ
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setColumnOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>100k Rows Virtual Table</h2>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div
          style={{
            border: "1px solid #ccc",
            width: "800px",
            maxWidth: "100%",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* ヘッダーエリア (固定) */}
          <div
            style={{
              display: "flex",
              width: "100%",
              fontWeight: "bold",
              borderBottom: "1px solid #ccc",
              overflow: "hidden", // 横スクロール制御は別途必要に応じて
            }}
          >
            <SortableContext
              items={columnOrder}
              strategy={horizontalListSortingStrategy}
            >
              {table.getHeaderGroups().map((headerGroup) => (
                <React.Fragment key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <DraggableTableHeader key={header.id} header={header}>
                      {/* ソート機能 */}
                      <div
                        onClick={header.column.getToggleSortingHandler()}
                        style={{ cursor: "pointer", marginBottom: "4px" }}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {{
                          asc: " 🔼",
                          desc: " 🔽",
                        }[header.column.getIsSorted() as string] ?? null}
                      </div>

                      {/* フィルタ入力 */}
                      {header.column.getCanFilter() ? (
                        <DebouncedInput
                          type="text"
                          value={
                            (header.column.getFilterValue() ?? "") as string
                          }
                          onChange={(value) =>
                            header.column.setFilterValue(value)
                          }
                          placeholder={`Search...`}
                        />
                      ) : null}
                    </DraggableTableHeader>
                  ))}
                </React.Fragment>
              ))}
            </SortableContext>
          </div>

          {/* ボディエリア (仮想スクロール) */}
          <div
            ref={parentRef}
            style={{
              height: "500px",
              overflow: "auto",
              position: "relative",
            }}
          >
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index];
                return (
                  <div
                    key={row.id}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                      display: "flex",
                      borderBottom: "1px solid #eee",
                      alignItems: "center",
                      backgroundColor:
                        virtualRow.index % 2 ? "#fff" : "#f9f9f9",
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <div
                        key={cell.id}
                        style={{
                          width: cell.column.getSize(), // カラム定義のsizeを使用
                          padding: "0 8px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DndContext>

      <p style={{ textAlign: "center", fontSize: "0.8rem", color: "#666" }}>
        Showing {rows.length} of {data.length} rows
      </p>
    </div>
  );
}
