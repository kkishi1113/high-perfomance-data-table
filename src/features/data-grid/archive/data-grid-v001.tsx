// // DataGridSheet.tsx
// // A single-file React + TypeScript DataGrid component designed for "near Google Sheets" performance.
// // Features:
// // - Vertical (rows) and horizontal (columns) virtualization using @tanstack/react-virtual
// // - Lightweight cell rendering with memoization
// // - Off-main-thread sorting/filtering via an inline Web Worker (Blob)
// // - Editable cells (basic), fast selection, keyboard navigation hooks (starter)
// // - Minimal Tailwind-ready styling; works with shadcn/ui if you want to wrap headers/buttons
// // Usage example:
// const defaultColumns = [
//   { id: "id", header: "ID", accessorKey: "id", width: 80 },
//   { id: "name", header: "Name", accessorKey: "name", width: 160 },
//   { id: "age", header: "Age", accessorKey: "age", width: 100 },
// ];
// const defaultRows = Array.from({ length: 50000 }, (_, i) => ({
//   id: i + 1,
//   name: `User ${i + 1}`,
//   age: 20 + (i % 50),
// }));
// // <DataGridSheet
// //    columns={columns}
// //    data={rows}
// //    estimatedColumnWidth={120}
// //    rowHeight={34}
// // />

// import React, {
//   useCallback,
//   useEffect,
//   useMemo,
//   useRef,
//   useState,
// } from "react";
// import { useVirtualizer } from "@tanstack/react-virtual";
// import {
//   createColumnHelper,
//   getCoreRowModel,
//   useReactTable,
// } from "@tanstack/react-table";

// // ---------- Inline Web Worker factory for sorting/filtering ----------
// function createWorker() {
//   const code = `
//     self.onmessage = function(e) {
//       const { id, op, payload } = e.data;
//       try {
//         if(op === 'sort'){
//           const { rows, sortBy, accessor } = payload;
//           const sorted = rows.slice().sort((a,b) => {
//             for(const s of sortBy){
//               const av = accessor(a, s.id);
//               const bv = accessor(b, s.id);
//               if(av == null && bv == null) continue;
//               if(av == null) return s.desc ? 1 : -1;
//               if(bv == null) return s.desc ? -1 : 1;
//               if(av > bv) return s.desc ? -1 : 1;
//               if(av < bv) return s.desc ? 1 : -1;
//             }
//             return 0;
//           });
//           postMessage({ id, result: sorted });
//         } else if(op === 'filter'){
//           const { rows, filters, accessor } = payload;
//           const filtered = rows.filter(r => {
//             for(const f of filters){
//               const v = accessor(r, f.id);
//               if(v == null) return false;
//               if(String(v).toLowerCase().indexOf(String(f.value).toLowerCase()) === -1) return false;
//             }
//             return true;
//           });
//           postMessage({ id, result: filtered });
//         }
//       } catch (err) {
//         postMessage({ id, error: String(err) });
//       }
//     }
//   `;
//   const blob = new Blob([code], { type: "application/javascript" });
//   const url = URL.createObjectURL(blob);
//   return new Worker(url);
// }

// // --------------- Types ---------------
// type ColumnDefSimple<T> = {
//   id: string;
//   header: string;
//   accessor?: (row: T) => any;
//   accessorKey?: keyof T & string;
//   width?: number;
// };

// type Props<T extends Record<string, any>> = {
//   columns?: ColumnDefSimple<T>[];
//   data?: T[];
//   rowHeight?: number;
//   headerHeight?: number;
//   estimatedColumnWidth?: number;
//   className?: string;
//   onChange?: (rows: T[]) => void; // optimistic edit handler
// };

// // ---------- Utility accessor used by worker (string path support if needed) ----------
// const defaultAccessor = (row: any, key: string) => {
//   if (typeof row !== "object" || row == null) return undefined;
//   return row[key];
// };

// // ---------- Main Component ----------
// export default function DataGridSheet<T extends Record<string, any>>({
//   columns = defaultColumns,
//   data = defaultRows,
//   rowHeight = 34,
//   headerHeight = 40,
//   estimatedColumnWidth = 120,
//   className = "",
//   onChange,
// }: Props<T>) {
//   // state: visibleRows (may be sorted/filtered via worker)
//   const [rows, setRows] = useState<T[]>(() => data);
//   const workerRef = useRef<Worker | null>(null);
//   const requestIdRef = useRef(0);

//   // Keep master data in sync when prop changes
//   useEffect(() => setRows(data), [data]);

//   // create worker
//   useEffect(() => {
//     workerRef.current = createWorker();
//     const w = workerRef.current;
//     return () => {
//       w.terminate();
//       workerRef.current = null;
//     };
//   }, []);

//   // Sort/filter request helper
//   const postWorker = useCallback((op: string, payload: any) => {
//     return new Promise<any>((resolve, reject) => {
//       const id = ++requestIdRef.current;
//       const w = workerRef.current;
//       if (!w) return resolve(null);
//       const to = (e: MessageEvent) => {
//         if (e.data?.id !== id) return;
//         w.removeEventListener("message", to);
//         if (e.data?.error) return reject(new Error(e.data.error));
//         resolve(e.data.result);
//       };
//       w.addEventListener("message", to);
//       w.postMessage({ id, op, payload });
//     });
//   }, []);

//   // Column widths memo
//   const colMeta = useMemo(() => {
//     return columns.map((c) => ({
//       id: c.id,
//       header: c.header,
//       width: c.width ?? estimatedColumnWidth,
//       accessor: c.accessor ?? ((r: any) => r[c.accessorKey ?? c.id]),
//     }));
//   }, [columns, estimatedColumnWidth]);

//   // Table setup (we use a lightweight react-table core for row model convenience)
//   const columnHelper = useMemo(() => createColumnHelper<any>(), []);
//   const tableColumns = useMemo(
//     () =>
//       colMeta.map((c) =>
//         columnHelper.accessor(c.id, {
//           id: c.id,
//           header: () => c.header,
//           cell: (info) => info.getValue(),
//         })
//       ),
//     [colMeta, columnHelper]
//   );

//   const table = useReactTable({
//     data: rows,
//     columns: tableColumns,
//     getCoreRowModel: getCoreRowModel(),
//   });

//   // Container refs
//   const parentRef = useRef<HTMLDivElement | null>(null);
//   const headerRef = useRef<HTMLDivElement | null>(null);

//   // Vertical virtualizer for rows
//   const rowVirtualizer = useVirtualizer({
//     count: table.getRowModel().rows.length,
//     getScrollElement: () => parentRef.current,
//     estimateSize: () => rowHeight,
//     overscan: 10,
//   });

//   // Horizontal virtualizer for columns
//   const totalColumnWidth = useMemo(
//     () => colMeta.reduce((s, c) => s + c.width, 0),
//     [colMeta]
//   );
//   const columnVirtualizer = useVirtualizer({
//     horizontal: true,
//     count: colMeta.length,
//     getScrollElement: () => parentRef.current,
//     estimateSize: (i) => colMeta[i].width,
//     overscan: 3,
//   });

//   // Simple in-place edit
//   const [editing, setEditing] = useState<{
//     rowIndex: number;
//     colId: string;
//   } | null>(null);
//   const updateCell = useCallback(
//     (rowIndex: number, colId: string, value: any) => {
//       setRows((prev) => {
//         const next = prev.slice();
//         // mutate shallow copy
//         next[rowIndex] = { ...next[rowIndex], [colId]: value };
//         onChange?.(next);
//         return next;
//       });
//     },
//     [onChange]
//   );

//   // Basic keyboard navigation (Enter to edit cell)
//   const onKeyDown = (e: React.KeyboardEvent) => {
//     if (e.key === "Enter" && editing) {
//       setEditing(null);
//     }
//   };

//   // Example: heavy sort using worker
//   const sortUsingWorker = async (sortBy: { id: string; desc?: boolean }[]) => {
//     const result = await postWorker("sort", {
//       rows: rows,
//       sortBy,
//       accessor: defaultAccessor.toString ? null : undefined, // accessor can't be passed; worker uses defaultAccessor
//       // Our worker uses defaultAccessor that indexes by key directly
//     }).catch(() => null);
//     if (result) setRows(result);
//   };

//   // Example filter (client) via worker
//   const filterUsingWorker = async (filters: { id: string; value: any }[]) => {
//     const result = await postWorker("filter", {
//       rows,
//       filters,
//       accessor: null,
//     }).catch(() => null);
//     if (result) setRows(result);
//   };

//   // Render
//   return (
//     <div className={`w-full h-full border rounded ${className}`}>
//       {/* Header (column headers) */}
//       <div
//         ref={headerRef}
//         className="sticky top-0 z-10 bg-white shadow-sm"
//         style={{ height: headerHeight, overflow: "hidden" }}
//       >
//         <div
//           style={{
//             width: totalColumnWidth,
//             height: headerHeight,
//             display: "flex",
//           }}
//         >
//           {columnVirtualizer.getVirtualItems().map((virtualCol) => {
//             const col = colMeta[virtualCol.index];
//             return (
//               <div
//                 key={col.id}
//                 className="flex items-center border-r px-2 text-sm font-medium"
//                 style={{
//                   width: col.width,
//                   height: headerHeight,
//                   minWidth: col.width,
//                 }}
//               >
//                 {col.header}
//               </div>
//             );
//           })}
//         </div>
//       </div>

//       {/* Body */}
//       <div
//         ref={parentRef}
//         tabIndex={0}
//         onKeyDown={onKeyDown}
//         className="overflow-auto"
//         style={{ height: `calc(100% - ${headerHeight}px)` }}
//       >
//         <div
//           style={{
//             height: rowVirtualizer.getTotalSize(),
//             width: totalColumnWidth,
//             position: "relative",
//           }}
//         >
//           {rowVirtualizer.getVirtualItems().map((virtualRow) => {
//             const rowIndex = virtualRow.index;
//             const row = table.getRowModel().rows[rowIndex];
//             if (!row) return null;
//             const top = virtualRow.start;
//             return (
//               <div
//                 key={row.id}
//                 className={`absolute left-0 flex items-stretch border-b hover:bg-gray-50`}
//                 style={{ top, height: rowHeight, width: totalColumnWidth }}
//               >
//                 <div style={{ display: "flex", width: totalColumnWidth }}>
//                   {columnVirtualizer.getVirtualItems().map((virtualCol) => {
//                     const col = colMeta[virtualCol.index];
//                     const cellValue = col.accessor(row.original);
//                     const isEditing =
//                       editing?.rowIndex === rowIndex &&
//                       editing?.colId === col.id;
//                     return (
//                       <div
//                         key={col.id}
//                         className="flex items-center px-2 text-sm overflow-hidden whitespace-nowrap"
//                         style={{
//                           width: col.width,
//                           minWidth: col.width,
//                           maxWidth: col.width,
//                         }}
//                         onDoubleClick={() =>
//                           setEditing({ rowIndex, colId: col.id })
//                         }
//                       >
//                         {isEditing ? (
//                           <input
//                             autoFocus
//                             defaultValue={String(cellValue ?? "")}
//                             onBlur={(e) => {
//                               updateCell(rowIndex, col.id, e.target.value);
//                               setEditing(null);
//                             }}
//                             onKeyDown={(e) => {
//                               if (e.key === "Enter") {
//                                 updateCell(
//                                   rowIndex,
//                                   col.id,
//                                   (e.target as HTMLInputElement).value
//                                 );
//                                 setEditing(null);
//                               }
//                             }}
//                             className="w-full h-full outline-none"
//                           />
//                         ) : (
//                           <div
//                             className="truncate"
//                             title={String(cellValue ?? "")}
//                           >
//                             {String(cellValue ?? "")}
//                           </div>
//                         )}
//                       </div>
//                     );
//                   })}
//                 </div>
//               </div>
//             );
//           })}
//         </div>
//       </div>

//       {/* Footer controls (example) */}
//       <div className="flex gap-2 p-2 border-t items-center">
//         <button
//           className="px-3 py-1 rounded bg-blue-500 text-white text-sm"
//           onClick={() =>
//             sortUsingWorker([{ id: columns[0]?.id ?? "", desc: false }])
//           }
//         >
//           Sort by 1st column
//         </button>
//         <button
//           className="px-3 py-1 rounded bg-gray-200 text-sm"
//           onClick={() => setRows(data)}
//         >
//           Reset
//         </button>
//       </div>
//     </div>
//   );
// }
