import React from "react";
import "./index.css";
import {
  type Cell,
  type ColumnDef,
  type Header,
  type HeaderGroup,
  type Row,
  type RowSelectionState,
  type Table,
  type VisibilityState,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  useVirtualizer,
  type VirtualItem,
  type Virtualizer,
} from "@tanstack/react-virtual";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { useQuery } from "@tanstack/react-query";

export function TanstackDataTableV003Container() {
  const columnHelper = createColumnHelper<string[]>();

  // カラム定義を修正（アクセサをプロパティ名指定に変更し、useMemo化）
  const columns = React.useMemo(
    () =>
      [
        columnHelper.display({
          id: "select",
          header: ({ table }) => (
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && "indeterminate")
              }
              onCheckedChange={(value) =>
                table.toggleAllPageRowsSelected(!!value)
              }
              aria-label="Select all"
            />
          ),
          cell: ({ row }) => (
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
            />
          ),
          enableSorting: false,
          enableHiding: false,
          size: 50,
        }),
        // ID (index 0)
        columnHelper.accessor((row) => row[0], {
          id: "id",
          header: "ID",
          cell: (info) => info.getValue(),
          size: 100,
        }),
        // Name (index 1)
        columnHelper.accessor((row) => row[1], {
          id: "name",
          header: "Name",
          cell: (info) => info.getValue(),
          size: 100,
        }),
        // Dynamic Columns (index 2 ~)
        ...Array.from({ length: 200 }).map((_, index) =>
          columnHelper.accessor((row) => row[index + 2], {
            id: `column${index}`,
            header: `Column ${index}`,
            cell: (info) => info.getValue(),
            size: 100,
          })
        ),
      ] as ColumnDef<string[], unknown>[],
    [columnHelper]
  );

  const { data, isFetching, error } = useQuery({
    queryKey: ["data"],
    queryFn: async () => {
      // モックデータの生成（10,000行 x 200列）
      await new Promise((resolve) => setTimeout(resolve, 200));

      // 配列の配列を生成
      return Array.from({ length: 100000 }).map((_, rowIndex) => {
        const row: string[] = new Array(202); // 事前にサイズ確保で高速化
        row[0] = rowIndex.toString(); // ID
        row[1] = `User ${rowIndex}`; // Name

        // 動的カラムのデータ生成
        for (let colIndex = 0; colIndex < 200; colIndex++) {
          row[colIndex + 2] = `Val ${rowIndex}-${colIndex}`;
        }
        return row;
      });
    },
    refetchOnWindowFocus: false,
  });

  if (isFetching && !data) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data) return <div>No data</div>;

  return <TanstackDataTableV003 data={data} columns={columns} />;
}
function TanstackDataTableV003<TData, TValue>({
  data,
  columns,
}: {
  data: TData[];
  columns: ColumnDef<TData, TValue>[];
}) {
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      rowSelection,
      columnVisibility,
    },
    debugTable: true,
  });

  //All important CSS styles are included as inline styles for this example. This is not recommended for your code.
  return (
    <div className="app">
      <div>({columns.length.toLocaleString()} columns)</div>
      <div>({data.length.toLocaleString()} rows)</div>
      <TableContainer table={table} />
    </div>
  );
}

interface TableContainerProps<TData> {
  table: Table<TData>;
}

function TableContainer<TData>({ table }: TableContainerProps<TData>) {
  const visibleColumns = table.getVisibleLeafColumns();

  //The virtualizers need to know the scrollable container element
  const tableContainerRef = React.useRef<HTMLDivElement>(null);

  //we are using a slightly different virtualization strategy for columns (compared to virtual rows) in order to support dynamic row heights
  const columnVirtualizer = useVirtualizer<
    HTMLDivElement,
    HTMLTableCellElement
  >({
    count: visibleColumns.length,
    estimateSize: (index) => visibleColumns[index].getSize(), //estimate width of each column for accurate scrollbar dragging
    getScrollElement: () => tableContainerRef.current,
    horizontal: true,
    overscan: 3, //how many columns to render on each side off screen each way (adjust this for performance)
  });

  const virtualColumns = columnVirtualizer.getVirtualItems();

  //different virtualization strategy for columns - instead of absolute and translateY, we add empty columns to the left and right
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
      className="container"
      ref={tableContainerRef}
      style={{
        overflow: "auto", //our scrollable table container
        position: "relative", //needed for sticky header
        height: "800px", //should be a fixed height
      }}
    >
      {/* Even though we're still using sematic table tags, we must use CSS grid and flexbox for dynamic row heights */}
      <table style={{ display: "grid" }}>
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
        />
      </table>
    </div>
  );
}

interface TableHeadProps<TData> {
  columnVirtualizer: Virtualizer<HTMLDivElement, HTMLTableCellElement>;
  table: Table<TData>;
  virtualPaddingLeft: number | undefined;
  virtualPaddingRight: number | undefined;
}

function TableHead<TData>({
  columnVirtualizer,
  table,
  virtualPaddingLeft,
  virtualPaddingRight,
}: TableHeadProps<TData>) {
  return (
    <thead
      style={{
        display: "grid",
        position: "sticky",
        top: 0,
        zIndex: 1,
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

interface TableHeadRowProps<TData> {
  columnVirtualizer: Virtualizer<HTMLDivElement, HTMLTableCellElement>;
  headerGroup: HeaderGroup<TData>;
  virtualPaddingLeft: number | undefined;
  virtualPaddingRight: number | undefined;
}

function TableHeadRow<TData>({
  columnVirtualizer,
  headerGroup,
  virtualPaddingLeft,
  virtualPaddingRight,
}: TableHeadRowProps<TData>) {
  const virtualColumns = columnVirtualizer.getVirtualItems();
  return (
    <tr key={headerGroup.id} style={{ display: "flex", width: "100%" }}>
      {virtualPaddingLeft ? (
        //fake empty column to the left for virtualization scroll padding
        <th style={{ display: "flex", width: virtualPaddingLeft }} />
      ) : null}
      {virtualColumns.map((virtualColumn) => {
        const header = headerGroup.headers[virtualColumn.index];
        return <TableHeadCell key={header.id} header={header} />;
      })}
      {virtualPaddingRight ? (
        //fake empty column to the right for virtualization scroll padding
        <th style={{ display: "flex", width: virtualPaddingRight }} />
      ) : null}
    </tr>
  );
}

interface TableHeadCellProps<TData> {
  header: Header<TData, unknown>;
}

function TableHeadCell<TData>({ header }: TableHeadCellProps<TData>) {
  return (
    <th
      key={header.id}
      style={{
        display: "flex",
        width: header.getSize(),
      }}
    >
      <div
        {...{
          className: header.column.getCanSort()
            ? "cursor-pointer select-none"
            : "",
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

interface TableBodyProps<TData> {
  columnVirtualizer: Virtualizer<HTMLDivElement, HTMLTableCellElement>;
  table: Table<TData>;
  tableContainerRef: React.RefObject<HTMLDivElement | null>;
  virtualPaddingLeft: number | undefined;
  virtualPaddingRight: number | undefined;
}

function TableBody<TData>({
  columnVirtualizer,
  table,
  tableContainerRef,
  virtualPaddingLeft,
  virtualPaddingRight,
}: TableBodyProps<TData>) {
  const { rows } = table.getRowModel();

  //dynamic row height virtualization - alternatively you could use a simpler fixed row height strategy without the need for `measureElement`
  const rowVirtualizer = useVirtualizer<HTMLDivElement, HTMLTableRowElement>({
    count: rows.length,
    estimateSize: () => 33, //estimate row height for accurate scrollbar dragging
    getScrollElement: () => tableContainerRef.current,
    //measure dynamic row height, except in firefox because it measures table border height incorrectly
    measureElement:
      typeof window !== "undefined" &&
      navigator.userAgent.indexOf("Firefox") === -1
        ? (element) => element?.getBoundingClientRect().height
        : undefined,
    overscan: 5,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <tbody
      style={{
        display: "grid",
        height: `${rowVirtualizer.getTotalSize()}px`, //tells scrollbar how big the table is
        position: "relative", //needed for absolute positioning of rows
      }}
    >
      {virtualRows.map((virtualRow) => {
        const row = rows[virtualRow.index] as Row<TData>;

        return (
          <TableBodyRow
            columnVirtualizer={columnVirtualizer}
            key={row.id}
            row={row}
            rowVirtualizer={rowVirtualizer}
            virtualPaddingLeft={virtualPaddingLeft}
            virtualPaddingRight={virtualPaddingRight}
            virtualRow={virtualRow}
          />
        );
      })}
    </tbody>
  );
}

interface TableBodyRowProps<TData> {
  columnVirtualizer: Virtualizer<HTMLDivElement, HTMLTableCellElement>;
  row: Row<TData>;
  rowVirtualizer: Virtualizer<HTMLDivElement, HTMLTableRowElement>;
  virtualPaddingLeft: number | undefined;
  virtualPaddingRight: number | undefined;
  virtualRow: VirtualItem;
}

function TableBodyRow<TData>({
  columnVirtualizer,
  row,
  rowVirtualizer,
  virtualPaddingLeft,
  virtualPaddingRight,
  virtualRow,
}: TableBodyRowProps<TData>) {
  const visibleCells = row.getVisibleCells();
  const virtualColumns = columnVirtualizer.getVirtualItems();
  return (
    <tr
      data-index={virtualRow.index} //needed for dynamic row height measurement
      ref={(node) => rowVirtualizer.measureElement(node)} //measure dynamic row height
      key={row.id}
      style={{
        display: "flex",
        position: "absolute",
        transform: `translateY(${virtualRow.start}px)`, //this should always be a `style` as it changes on scroll
        width: "100%",
      }}
    >
      {virtualPaddingLeft ? (
        //fake empty column to the left for virtualization scroll padding
        <td style={{ display: "flex", width: virtualPaddingLeft }} />
      ) : null}
      {virtualColumns.map((vc) => {
        const cell = visibleCells[vc.index];
        return <TableBodyCell key={cell.id} cell={cell} />;
      })}
      {virtualPaddingRight ? (
        //fake empty column to the right for virtualization scroll padding
        <td style={{ display: "flex", width: virtualPaddingRight }} />
      ) : null}
    </tr>
  );
}

interface TableBodyCellProps<TData, TValue> {
  cell: Cell<TData, TValue>;
}

function TableBodyCell<TData, TValue>({
  cell,
}: TableBodyCellProps<TData, TValue>) {
  return (
    <td
      key={cell.id}
      style={{
        display: "flex",
        width: cell.column.getSize(),
      }}
    >
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </td>
  );
}
