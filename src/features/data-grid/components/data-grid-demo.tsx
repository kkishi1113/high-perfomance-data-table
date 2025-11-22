import { useMemo } from "react";
import { DataGrid } from "./data-grid";
import type { ColumnDefSimple } from "../types";
import { faker } from "@faker-js/faker";

type Person = {
  id: number;
  firstName: string;
  lastName: string;
  [key: string]: string | number; // Allow dynamic columns
};

const makeData = (count: number, colCount: number): Person[] => {
  const data: Person[] = [];
  for (let i = 0; i < count; i++) {
    const row: Person = {
      id: i + 1,
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
    };

    for (let j = 0; j < colCount; j++) {
      row[`col${j}`] = `Cell-${i}-${j}`;
    }
    data.push(row);
  }
  return data;
};

export function DataGridDemo() {
  const colCount = 200;
  const data = useMemo(() => makeData(1000, colCount), [colCount]);

  const columns = useMemo(() => {
    const cols: ColumnDefSimple<Person>[] = [
      {
        id: "id",
        header: "ID",
        accessorKey: "id",
        width: 60,
        enablePinning: true,
        defaultPinned: 'left',
      },
      {
        id: "firstName",
        header: "First Name",
        accessorKey: "firstName",
        width: 120,
        enablePinning: true,
        defaultPinned: 'left',
      },
      {
        id: "lastName",
        header: "Last Name",
        accessorKey: "lastName",
        width: 120,
      },
    ];

    for (let i = 0; i < colCount; i++) {
      cols.push({
        id: `col${i}`,
        header: `Column ${i + 1}`,
        accessorKey: `col${i}`,
        width: 120,
      });
    }
    return cols;
  }, [colCount]);

  return (
    <div className="w-full h-[600px] p-4">
      <h2 className="text-xl font-bold mb-4">High Performance Data Grid (1k rows x {colCount} cols)</h2>
      <DataGrid
        columns={columns}
        data={data}
        className="h-[600px] w-full"
        enableRowSelection
        enableColumnResizing
        enableSorting
        // 初期状態でカラムをピン留めする（DataGridコンポーネント側でstateを受け取るように拡張が必要だが、
        // 現状は内部stateで管理しているため、propsで初期値を渡せるようにするか、
        // DataGrid側でデフォルトのピン留めロジックを実装する必要がある。
        // ここでは、DataGridコンポーネントが初期値を受け取れるように修正したと仮定、
        // またはDataGridコンポーネントのdefaultPropsで対応する。）
      />
    </div>
  );
}
