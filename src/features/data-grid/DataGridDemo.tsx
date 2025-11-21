import { useMemo } from "react";
import { DataGrid } from "./DataGrid";
import type { ColumnDefSimple } from "./types";
import { faker } from "@faker-js/faker";

type Person = {
  id: number;
  firstName: string;
  lastName: string;
  age: number;
  email: string;
  city: string;
  state: string;
  jobTitle: string;
  company: string;
};

const makeData = (count: number): Person[] => {
  const data: Person[] = [];
  for (let i = 0; i < count; i++) {
    data.push({
      id: i + 1,
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      age: faker.number.int({ min: 18, max: 90 }),
      email: faker.internet.email(),
      city: faker.location.city(),
      state: faker.location.state(),
      jobTitle: faker.person.jobTitle(),
      company: faker.company.name(),
    });
  }
  return data;
};

export function DataGridDemo() {
  const data = useMemo(() => makeData(100000), []);

  const columns: ColumnDefSimple<Person>[] = [
    { id: "id", header: "ID", accessorKey: "id", width: 80 },
    { id: "firstName", header: "First Name", accessorKey: "firstName", width: 150 },
    { id: "lastName", header: "Last Name", accessorKey: "lastName", width: 150 },
    { id: "age", header: "Age", accessorKey: "age", width: 80 },
    { id: "email", header: "Email", accessorKey: "email", width: 250 },
    { id: "jobTitle", header: "Job Title", accessorKey: "jobTitle", width: 200 },
    { id: "company", header: "Company", accessorKey: "company", width: 200 },
    { id: "city", header: "City", accessorKey: "city", width: 150 },
    { id: "state", header: "State", accessorKey: "state", width: 150 },
  ];

  return (
    <div className="w-full h-[600px] p-4">
      <h2 className="text-xl font-bold mb-4">High Performance Data Grid (100k rows)</h2>
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
