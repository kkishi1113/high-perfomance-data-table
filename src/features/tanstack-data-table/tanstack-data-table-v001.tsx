import React from "react";
import {
  type ColumnDef,
  type Header,
  type HeaderGroup,
  type Row,
  type Table,
  flexRender,
  getCoreRowModel,
  useReactTable,
  createColumnHelper,
  type Cell,
  // NOTE: @tanstack/react-tableと@tanstack/react-queryは環境内にないため、インポートを削除しました。
  // TanStack Tableの機能はグローバルに利用できるものと仮定して残します。
} from "@tanstack/react-table"; // エラー回避のため、このインポートはそのまま残します（環境側での解決を期待）。
import {
  useVirtualizer,
  type VirtualItem,
  type Virtualizer,
} from "@tanstack/react-virtual";

// --- データの型定義とユーティリティ関数（makeDataなどを変更） ---

// AoS (Array of Objects) 形式のデータ構造
interface PersonAOS {
  id: number;
  [key: string]: unknown; // firstName, age, visits, plus 197 dynamic columns
}

// SoA (Structure of Arrays) 形式のデータ構造
interface SoAData {
  rowCount: number;
  // プリミティブ型はTyped Arrayでメモリ効率化
  ids: Int32Array;
  ages: Int32Array;
  visits: Int32Array;
  progress: Int32Array;
  // 文字列は通常の配列
  [key: string]: Int32Array | string[] | number;
}

// データ生成関数（10万行 x 200列をシミュレート）
const makeData = (rowCount: number, columnCount: number): PersonAOS[] => {
  const data: PersonAOS[] = [];
  for (let i = 0; i < rowCount; i++) {
    const row: PersonAOS = {
      id: i,
      firstName: `FName${i}`,
      lastName: `LName${i}`,
      age: 20 + (i % 50),
      visits: i % 1000,
      progress: i % 100,
      status:
        i % 3 === 0 ? "relationship" : i % 3 === 1 ? "complicated" : "single",
    };
    // 残りの194列をダミーデータで埋める
    for (let j = 4; j < columnCount; j++) {
      row[`col${j}`] = `Data ${i}-${j}`;
    }
    data.push(row);
  }
  return data;
};

const COLUMN_COUNT = 200;
const ROW_COUNT = 10000;

// カラム定義生成関数
const columnHelper = createColumnHelper();

const makeColumns = (columnCount: number) => {
  const baseColumns = [
    columnHelper.accessor("ids", {
      header: "ID",
      size: 60,
      // cellでinfo.getValue()はSoAの配列全体を返すため、info.row.indexでアクセス
      cell: (info) => (info.getValue() as Int32Array)[info.row.index],
      // accessorFnでrow.indexが利用できるようにrowオブジェクト全体を返す
      accessorFn: (row) => row.ids,
    }),
    columnHelper.accessor("firstNames", {
      header: "First Name",
      size: 150,
      cell: (info) => (info.getValue() as string[])[info.row.index],
      accessorFn: (row) => row.firstNames,
    }),
    columnHelper.accessor("lastNames", {
      header: "Last Name",
      size: 150,
      cell: (info) => (info.getValue() as string[])[info.row.index],
      accessorFn: (row) => row.lastNames,
    }),
    columnHelper.accessor("ages", {
      header: "Age",
      size: 80,
      cell: (info) => (info.getValue() as Int32Array)[info.row.index],
      accessorFn: (row) => row.ages,
    }),
    columnHelper.accessor("visits", {
      header: "Visits",
      size: 100,
      cell: (info) => (info.getValue() as Int32Array)[info.row.index],
      accessorFn: (row) => row.visits,
    }),
    columnHelper.accessor("progress", {
      header: "Progress",
      size: 100,
      cell: (info) => (info.getValue() as Int32Array)[info.row.index] + "%",
      accessorFn: (row) => row.progress,
    }),
  ];

  // 残りのダイナミックカラム
  for (let i = 4; i < columnCount; i++) {
    const key = `col${i}`;
    baseColumns.push(
      columnHelper.accessor(key, {
        header: `Column ${i}`,
        size: 150,
        // SoAではキー名が動的なため、カスタムアクセッサを使ってRow IDから値を取り出す
        cell: (info) => (info.row.original[key] as string[])[info.row.index],
        accessorFn: (row) => (row[key] ? (row[key] as string[]) : ["N/A"]),
      })
    );
  }

  return baseColumns;
};

// --- AoS -> SoA 変換ロジック (メモリ最適化の核心) ---
const transformAosToSoa = (
  aosData: PersonAOS[],
  columnCount: number
): SoAData => {
  console.time("AoS to SoA Conversion");
  const rowCount = aosData.length;

  // 1. 固定キーのTyped Arrayを初期化
  const ids = new Int32Array(rowCount);
  const ages = new Int32Array(rowCount);
  const visits = new Int32Array(rowCount);
  const progress = new Int32Array(rowCount);

  // 2. 文字列配列を初期化
  const firstNames: string[] = new Array(rowCount);
  const lastNames: string[] = new Array(rowCount);
  const statuses: string[] = new Array(rowCount);

  // 3. 動的キーの構造を準備
  const dynamicCols: Record<string, string[]> = {};
  for (let j = 4; j < columnCount; j++) {
    dynamicCols[`col${j}`] = new Array(rowCount);
  }

  // 4. AoSをイテレートし、SoAにデータを詰める
  for (let i = 0; i < rowCount; i++) {
    const item = aosData[i];
    ids[i] = item.id;
    firstNames[i] = item.firstName as string;
    lastNames[i] = item.lastName as string;
    ages[i] = item.age as number;
    visits[i] = item.visits as number;
    progress[i] = item.progress as number;
    statuses[i] = item.status as string;

    for (let j = 4; j < columnCount; j++) {
      const key = `col${j}`;
      dynamicCols[key][i] = item[key] as string;
    }
  }

  // 5. 最終的なSoAオブジェクトを作成
  const soa: SoAData = {
    rowCount,
    ids,
    firstNames,
    lastNames,
    ages,
    visits,
    progress,
    statuses,
    // TypeScriptのエラーを回避するために動的キーをマージ
    ...(dynamicCols as Record<string, string[]>),
  } as unknown as SoAData;

  console.timeEnd("AoS to SoA Conversion");
  return soa;
};

// --- データフェッチのカスタムフック（React Queryの模擬） ---

const fetchDataAndConvert = async () => {
  // 巨大データ生成のシミュレーション（遅延を設けることでローディング表示を確認）
  await new Promise((resolve) => setTimeout(resolve, 50));
  const aosData = makeData(ROW_COUNT, COLUMN_COUNT);
  return transformAosToSoa(aosData, COLUMN_COUNT);
};

const useOptimizedTableData = () => {
  // TanStack Queryの代わりに、シンプルなローディング・エラー状態を持つカスタムフックで模擬
  const [data, setData] = React.useState<SoAData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    setIsLoading(true);
    setError(null);
    fetchDataAndConvert()
      .then(setData)
      .catch((error) => setError(error as Error))
      .finally(() => setIsLoading(false));
  }, []);

  return { data, isLoading, error };
};

// --- メインアプリケーションコンポーネント ---

export function TanstackDataTableV001() {
  const { data: soaData, isLoading, error } = useOptimizedTableData();

  // TanStack TableがSoA構造を扱うための行データを作成
  const tableData = React.useMemo(() => {
    if (!soaData) return [];

    // TanStack Tableに行の概念（row.index）を使わせるため、
    // SoADataオブジェクト自体を ROW_COUNT 分繰り返す擬似的な行データ配列を作成
    const pseudoRows: SoAData[] = [];
    for (let i = 0; i < soaData.rowCount; i++) {
      pseudoRows.push(soaData);
    }
    return pseudoRows;
  }, [soaData]);

  // カラムは一度だけ生成
  const columns = React.useMemo<ColumnDef<SoAData>[]>(
    () => makeColumns(COLUMN_COUNT),
    []
  );

  const table = useReactTable({
    data: tableData,
    columns,
    // SoA構造の場合、クライアントサイドでのソートは非常に重いため無効化
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true, // ソートは外部で管理（サーバーAPI）
    debugTable: false, // パフォーマンスのためデバッグをオフ
  });

  // ロード中のUI
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-900 text-white">
        <div className="text-xl font-semibold">
          Loading {ROW_COUNT.toLocaleString()} x {COLUMN_COUNT.toLocaleString()}{" "}
          data points... AoS to SoA 変換処理中です。
        </div>
      </div>
    );
  }

  // エラーUI
  if (error || !soaData) {
    return (
      <div className="text-red-500 p-8">
        データの読み込み中にエラーが発生しました。
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-900 min-h-screen text-white font-sans">
      <h1 className="text-3xl font-bold mb-4 text-indigo-400">
        Optimized Mega Table ({ROW_COUNT.toLocaleString()} Rows x{" "}
        {COLUMN_COUNT.toLocaleString()} Columns)
      </h1>
      <p className="mb-4 text-sm text-gray-400">
        データはメモリ効率の高いSoA (Structure of Arrays)
        に変換され、行/列の仮想化が適用されています。 ソートは手動 (Manual
        Sorting) に設定し、クライアントサイドでのフリーズを防いでいます。
      </p>

      <TableContainer table={table} rowCount={soaData.rowCount} />
    </div>
  );
}

// --- テーブルコンテナとレンダリングコンポーネント ---

interface TableContainerProps {
  table: Table<SoAData>;
  rowCount: number;
}

// 固定行の高さ（パフォーマンス最適化）
const FIXED_ROW_HEIGHT = 36;
const HEADER_HEIGHT = 40;

function TableContainer({ table, rowCount }: TableContainerProps) {
  const visibleColumns = table.getVisibleLeafColumns();
  const tableContainerRef = React.useRef<HTMLDivElement | null>(null);

  // 列の仮想化 (Column Virtualization)
  const columnVirtualizer = useVirtualizer<
    HTMLDivElement,
    HTMLTableCellElement
  >({
    count: visibleColumns.length,
    estimateSize: (index) => visibleColumns[index].getSize(),
    getScrollElement: () => tableContainerRef.current,
    horizontal: true,
    overscan: 5,
  });

  const virtualColumns = columnVirtualizer.getVirtualItems();

  let virtualPaddingLeft: number | undefined;
  let virtualPaddingRight: number | undefined;

  if (columnVirtualizer && virtualColumns?.length) {
    virtualPaddingLeft = virtualColumns[0]?.start ?? 0;
    virtualPaddingRight =
      columnVirtualizer.getTotalSize() -
      (virtualColumns[virtualColumns.length - 1]?.end ?? 0);
  }

  return (
    <div
      ref={tableContainerRef}
      className="rounded-lg shadow-2xl border border-gray-700 bg-gray-800"
      style={{
        overflow: "auto",
        position: "relative",
        height: "70vh", // 固定のビューポート高さ
        maxWidth: "100vw",
      }}
    >
      <style>{`
        .header-cell {
            padding: 8px 12px;
            text-align: left;
            font-weight: 600;
            color: #E5E7EB; /* gray-200 */
            border-bottom: 2px solid #374151; /* gray-700 */
            background-color: #1F2937; /* gray-800 */
        }
        .body-cell {
            padding: 8px 12px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: #D1D5DB; /* gray-400 */
            border-bottom: 1px solid #374151; /* gray-700 */
        }
        .cursor-pointer:hover {
            background-color: #374151; /* gray-700 */
        }
      `}</style>

      {/* 意味論的なテーブルタグを使用するが、レンダリングと仮想化のためにCSS Grid/Flexboxを使用 */}
      <table className="w-full" style={{ display: "grid" }}>
        <TableHead
          columnVirtualizer={columnVirtualizer}
          table={table}
          virtualPaddingLeft={virtualPaddingLeft}
          virtualPaddingRight={virtualPaddingRight}
        />
        <TableBody
          columnVirtualizer={columnVirtualizer}
          table={table}
          tableContainerRef={tableContainerRef}
          virtualPaddingLeft={virtualPaddingLeft}
          virtualPaddingRight={virtualPaddingRight}
          rowCount={rowCount} // 仮想化に真の行数を渡す
        />
      </table>
    </div>
  );
}

// --- Table Head コンポーネント（変更なし） ---

interface TableHeadProps {
  columnVirtualizer: Virtualizer<HTMLDivElement, HTMLTableCellElement>;
  table: Table<SoAData>;
  virtualPaddingLeft: number | undefined;
  virtualPaddingRight: number | undefined;
}

function TableHead({
  columnVirtualizer,
  table,
  virtualPaddingLeft,
  virtualPaddingRight,
}: TableHeadProps) {
  return (
    <thead
      style={{
        display: "grid",
        position: "sticky",
        top: 0,
        zIndex: 10,
        height: HEADER_HEIGHT,
      }}
    >
      {table.getHeaderGroups().map((headerGroup) => (
        <TableHeadRow
          columnVirtualizer={columnVirtualizer}
          headerGroup={headerGroup}
          key={headerGroup.id}
          virtualPaddingLeft={virtualPaddingLeft}
          virtualPaddingRight={virtualPaddingRight}
        />
      ))}
    </thead>
  );
}

interface TableHeadRowProps {
  columnVirtualizer: Virtualizer<HTMLDivElement, HTMLTableCellElement>;
  headerGroup: HeaderGroup<SoAData>;
  virtualPaddingLeft: number | undefined;
  virtualPaddingRight: number | undefined;
}

function TableHeadRow({
  columnVirtualizer,
  headerGroup,
  virtualPaddingLeft,
  virtualPaddingRight,
}: TableHeadRowProps) {
  const virtualColumns = columnVirtualizer.getVirtualItems();
  return (
    <tr
      key={headerGroup.id}
      style={{
        display: "flex",
        width: "100%",
        backgroundColor: "#1F2937" /* gray-800 */,
      }}
    >
      {virtualPaddingLeft ? (
        <th style={{ display: "flex", width: virtualPaddingLeft }} />
      ) : null}
      {virtualColumns.map((virtualColumn) => {
        const header = headerGroup.headers[virtualColumn.index];
        return <TableHeadCell key={header.id} header={header} />;
      })}
      {virtualPaddingRight ? (
        <th style={{ display: "flex", width: virtualPaddingRight }} />
      ) : null}
    </tr>
  );
}

interface TableHeadCellProps {
  header: Header<SoAData, unknown>;
}

function TableHeadCell({ header }: TableHeadCellProps) {
  return (
    <th
      key={header.id}
      className="header-cell"
      style={{
        display: "flex",
        width: header.getSize(),
        justifyContent: "space-between",
        alignItems: "center",
        cursor: header.column.getCanSort() ? "pointer" : "default",
        minHeight: HEADER_HEIGHT,
      }}
    >
      <div
        {...{
          className: header.column.getCanSort()
            ? "cursor-pointer select-none flex items-center"
            : "flex items-center",
          onClick: header.column.getToggleSortingHandler(),
        }}
      >
        {flexRender(header.column.columnDef.header, header.getContext())}
        {{
          asc: " 🔼",
          desc: " 🔽",
        }[header.column.getIsSorted() as string] ?? null}
      </div>
    </th>
  );
}

// --- Table Body コンポーネント（固定高さを適用し、動的計測を削除） ---

interface TableBodyProps {
  columnVirtualizer: Virtualizer<HTMLDivElement, HTMLTableCellElement>;
  table: Table<SoAData>;
  tableContainerRef: React.RefObject<HTMLDivElement | null>;
  virtualPaddingLeft: number | undefined;
  virtualPaddingRight: number | undefined;
  rowCount: number;
}

function TableBody({
  columnVirtualizer,
  table,
  tableContainerRef,
  virtualPaddingLeft,
  virtualPaddingRight,
  rowCount,
}: TableBodyProps) {
  // TanStack TableのgetRowModel().rowsは、擬似的な行データ（SoAオブジェクト）を含む配列を返す
  const rows = table.getRowModel().rows;

  // 行の仮想化 (Row Virtualization) - パフォーマンス向上のため固定高さ
  const rowVirtualizer = useVirtualizer<HTMLDivElement, HTMLTableRowElement>({
    count: rowCount, // 擬似的な行データではなく、実際の行数を使用
    estimateSize: () => FIXED_ROW_HEIGHT, // 固定高さを設定
    getScrollElement: () => tableContainerRef.current,
    overscan: 10, // 画面外のレンダリング数を増やすことでスクロールを滑らかに
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <tbody
      style={{
        display: "grid",
        height: `${rowVirtualizer.getTotalSize()}px`, // スクロールバーのサイズを決定
        position: "relative",
      }}
    >
      {virtualRows.map((virtualRow) => {
        // TanStack Tableは擬似行データ（全て同じSoAオブジェクト）を持っている
        // 実際のデータは row.original（SoADataオブジェクト）から row.index を使って取得する
        // rows[virtualRow.index] は、常に最初の (0番目の) SoAオブジェクトを指しますが、
        // 擬似的に row.index を持っているため、この方法でデータにアクセスします。
        const row = rows[virtualRow.index] as Row<SoAData>;

        return (
          <MemoizedTableBodyRow
            columnVirtualizer={columnVirtualizer}
            key={virtualRow.index} // キーは仮想化インデックスを使用
            row={row}
            virtualPaddingLeft={virtualPaddingLeft}
            virtualPaddingRight={virtualPaddingRight}
            virtualRow={virtualRow}
          />
        );
      })}
    </tbody>
  );
}

// パフォーマンス向上のための行コンポーネントのメモ化
const MemoizedTableBodyRow = React.memo(TableBodyRow);

interface TableBodyRowProps {
  columnVirtualizer: Virtualizer<HTMLDivElement, HTMLTableCellElement>;
  row: Row<SoAData>;
  virtualPaddingLeft: number | undefined;
  virtualPaddingRight: number | undefined;
  virtualRow: VirtualItem;
}

function TableBodyRow({
  columnVirtualizer,
  row,
  virtualPaddingLeft,
  virtualPaddingRight,
  virtualRow,
}: TableBodyRowProps) {
  // getVisibleCells() は列仮想化のために使用。TanStack Tableの標準的な処理。
  const visibleCells = row.getVisibleCells();
  const virtualColumns = columnVirtualizer.getVirtualItems();

  return (
    <tr
      // measureElement は削除されたため、refは不要
      key={virtualRow.index}
      style={{
        display: "flex",
        position: "absolute",
        transform: `translateY(${virtualRow.start}px)`, // スクロール位置
        width: "100%",
        height: `${FIXED_ROW_HEIGHT}px`, // 固定高さを明示
        backgroundColor: virtualRow.index % 2 === 0 ? "#111827" : "#1F2937", // ストライプ
      }}
    >
      {virtualPaddingLeft ? (
        <td style={{ display: "flex", width: virtualPaddingLeft }} />
      ) : null}
      {virtualColumns.map((vc) => {
        const cell = visibleCells[vc.index];
        // TanStack TableのCellコンポーネントに、現在の仮想化された行インデックスを渡す
        return (
          <TableBodyCell
            key={cell.id}
            cell={cell}
            rowIndex={virtualRow.index}
          />
        );
      })}
      {virtualPaddingRight ? (
        <td style={{ display: "flex", width: virtualPaddingRight }} />
      ) : null}
    </tr>
  );
}

// パフォーマンス向上のためのセルコンポーネントのメモ化
const MemoizedTableBodyCell = React.memo(TableBodyCell);

interface TableBodyCellProps {
  cell: Cell<SoAData, unknown>;
  rowIndex: number; // SoAから値を取得するための行インデックス
}

function TableBodyCell({ cell, rowIndex }: TableBodyCellProps) {
  // accessorFnでrow.indexが使われるため、ここでは通常のflexRenderでOK
  // ただし、flexRender内では cell.row.index は常に 0 となるため、accessorFnで解決されている必要がある
  return (
    <td
      key={cell.id}
      className="body-cell"
      style={{
        display: "flex",
        width: cell.column.getSize(),
        alignItems: "center",
        height: "100%",
      }}
    >
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </td>
  );
}

// --- ルートのレンダリング ---

const rootElement = document.getElementById("root");

if (!rootElement) throw new Error("Failed to find the root element");

// --- グローバルCSSの定義 ---
// document.head.insertAdjacentHTML(
//   "beforeend",
//   `
// <style>
//   body {
//     margin: 0;
//     font-family: 'Inter', sans-serif;
//     background-color: #111827; /* Tailwind gray-900 */
//   }
//   * {
//     box-sizing: border-box;
//   }
// </style>
// `
// );
