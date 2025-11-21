import { useMemo } from "react";
import { DataGrid } from "./DataGrid";
import type { ColumnDefSimple } from "./types";
import { faker } from "@faker-js/faker";

type Person = {
  id: number;
  firstName: string;
  lastName: string;
  [key: string]: any; // Allow dynamic columns
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
      { id: "id", header: "ID", accessorKey: "id", width: 80, enablePinning: true },
      { id: "firstName", header: "First Name", accessorKey: "firstName", width: 150 },
      { id: "lastName", header: "Last Name", accessorKey: "lastName", width: 150 },
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
        className="h-[500px]"
        enableRowSelection
        enableColumnResizing
        enableSorting
      />
    </div>
  );
}
