"use client";

import * as React from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type RowData = { id: number; [key: string]: string | number };

export function VirtualDataTable() {
  const colCount = 100;
  const rowCount = 1000;

  const columns: ColumnDef<RowData>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
        />
      ),
      size: 40,
    },
    ...Array.from({ length: colCount }, (_, i) => ({
      accessorKey: `col${i + 1}`,
      header: `Col ${i + 1}`,

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cell: (info: any) => info.getValue(),
      size: 120,
    })),
  ];

  const [data] = React.useState<RowData[]>(
    Array.from({ length: rowCount }, (_, rowIndex) => {
      const row: RowData = { id: rowIndex + 1 };
      for (let col = 0; col < colCount; col++) {
        row[`col${col + 1}`] = `R${rowIndex + 1}C${col + 1}`;
      }
      return row;
    })
  );

  const [rowSelection, setRowSelection] = React.useState({});

  const table = useReactTable({
    data,
    columns,
    state: { rowSelection },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
  });

  const parentRef = React.useRef<HTMLDivElement>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  //   const headerRef = React.useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => bodyRef.current,
    estimateSize: () => 36,
    overscan: 10,
  });

  const colVirtualizer = useVirtualizer({
    horizontal: true,
    count: table.getAllLeafColumns().length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => table.getAllLeafColumns()[index]?.getSize() ?? 120,
    overscan: 5,
  });

  //   // 横スクロールをヘッダーと同期
  //   React.useEffect(() => {
  //     const syncScroll = () => {
  //       if (headerRef.current && parentRef.current) {
  //         headerRef.current.scrollLeft = parentRef.current.scrollLeft;
  //       }
  //     };
  //     const el = parentRef.current;
  //     el?.addEventListener("scroll", syncScroll);
  //     return () => el?.removeEventListener("scroll", syncScroll);
  //   }, []);

  return (
    <div className="w-full border rounded-md">
      {/* スクロール全体管理 */}
      <div
        ref={parentRef}
        className="w-full overflow-x-auto"
        style={{ maxHeight: "600px" }}
      >
        {/* 固定ヘッダー */}
        {/* <div
          ref={headerRef}
          className="sticky top-0 z-10 bg-background border-b"
          style={{
            width: colVirtualizer.getTotalSize(),
            overflow: "hidden",
          }}
        >
          <Table>
            <TableHeader>
              <TableRow className="flex">
                {colVirtualizer.getVirtualItems().map((vc) => {
                  const header = table.getHeaderGroups()[0].headers[vc.index];
                  return (
                    <TableHead
                      key={header.id}
                      style={{
                        minWidth: vc.size,
                        transform: `translateX(${vc.start}px)`,
                        position: "absolute",
                        top: 0,
                        left: 0,
                        borderRight: "1px solid #ddd",
                        padding: "4px",
                      }}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
          </Table>
        </div> */}

        {/* ボディ */}
        <div
          ref={bodyRef}
          className="relative overflow-y-auto"
          style={{
            width: colVirtualizer.getTotalSize(),
            height: 560,
            position: "relative",
          }}
        >
          <Table>
            <TableHeader className="sticky">
              <TableRow className="flex">
                {colVirtualizer.getVirtualItems().map((vc) => {
                  const header = table.getHeaderGroups()[0].headers[vc.index];
                  return (
                    <TableHead
                      key={header.id}
                      className="bg-white sticky"
                      style={{
                        minWidth: vc.size,
                        transform: `translateX(${vc.start}px)`,
                        top: 0,
                        left: 0,
                        borderRight: "1px solid #ddd",
                        padding: "4px",
                      }}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody
              style={{
                height: rowVirtualizer.getTotalSize(),
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((vr) => {
                const row = table.getRowModel().rows[vr.index];
                return (
                  <TableRow
                    key={row.id}
                    className="flex"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      transform: `translateY(${vr.start}px)`,
                      height: vr.size,
                      width: "fit-content",
                    }}
                  >
                    {colVirtualizer.getVirtualItems().map((vc) => {
                      const cell = row.getVisibleCells()[vc.index];
                      return (
                        <TableCell
                          key={cell.id}
                          style={{
                            minWidth: vc.size,
                            transform: `translateX(${vc.start}px)`,
                            position: "absolute",
                            padding: "4px",
                            borderRight: "1px solid #eee",
                          }}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
