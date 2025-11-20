import type { UseQueryOptions } from "@tanstack/react-query";
import type {
  ColumnFiltersState,
  SortingState,
  Table,
} from "@tanstack/react-table";
import type { Virtualizer } from "@tanstack/react-virtual";

export type DataTableContainerProps<TData> = {
  queryOptions?: UseQueryOptions<TData, Error>;
};
// function DataTableContainer<TData>({
//   queryOptions,
// }: DataTableContainerProps<TData>) {
//   const { data, isPending } = useQuery<TData, Error>(queryOptions);
//   if (isPending) return <div>Loading...</div>;
//   if (!data) return <div>No data</div>;
//   return <DataTable data={data} columns={columns} />;
// }

export type DataTableProps<TData, TValue> = {
  data: TData[][];
  columns: TValue[];
};
export type UseDataTable<TData, TValue> = (
  rowsData: TData[][],
  columnsData: TValue[],
  options?: {
    state?: {
      rowSelection?: Record<string, boolean>;
      sorting?: SortingState;
      columnFilters?: ColumnFiltersState;
      columnOrder?: string[];
    };
    features?: {
      rowSelection?: boolean;
      sorting?: boolean;
      columnFilters?: boolean;
      columnOrder?: boolean;
    };
  }
) => Table<TData>;
// function useDataTable<TData, TValue>(props){}
// function DataTable<TData, TValue>({
//   data,
//   columns,
// }: DataTableProps<TData, TValue>) {
//   const table = useDataTable({
//     data,
//     columns,
//     options: {
//       state: {
//         rowSelection: {},
//         sorting: [],
//         columnFilters: [],
//         columnOrder: [],
//       },
//       features: {
//         rowSelection: true,
//         sorting: true,
//         columnFilters: true,
//         columnOrder: true,
//       },
//     },
//   });

//   return table.options.features.virtualizer ? (
//     <VirtualTable table={table} />
//   ) : (
//     <div>
//       <TableActions table={table} />
//       <Table table={table}>
//         <TableHeader />
//         <TableBody />
//       </Table>
//     </div>
//   );
// }

export type TableActionsProps<TData> = {
  table: Table<TData>;
  virtualizer?: UseDataTableVirtualizer<TData>;
};
// function TableActions<TData>({ table, virtualizer }: TableActionsProps<TData>) {
//   return <div>TableActions</div>;
// }

export type VirtualTableProps<TData> = {
  table: Table<TData>;
};
export type UseDataTableVirtualizer<TData> = (table: Table<TData>) => {
  row: Virtualizer<HTMLDivElement, Element>;
  column: Virtualizer<HTMLDivElement, Element>;
};
// function useDataTableVirtualizer<TData>(table: Table<TData>): {
//   row: Virtualizer<HTMLDivElement, Element>;
//   column: Virtualizer<HTMLDivElement, Element>;
// } {
//   return {
//     row: useVirtualizer({ count: table.getRowModel().rows.length, getScrollElement: () => table.getScrollElement(), estimateSize: () => 36, overscan: 10 }),
//   };
// }
// function VirtualTable<TData>({ table }: VirtualTableProps<TData>) {
//   const virtualizer = useDataTableVirtualizer(table);
//   return (
//     <div>
//       <TableActions table={table} virtualizer={virtualizer} />
//       <Table table={table}>
//         <TableHeader />
//         <TableBody />
//       </Table>
//     </div>
//   );
// }
