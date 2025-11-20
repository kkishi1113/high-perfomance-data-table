import "./App.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { VirtualDataTable } from "@/features/data-table/data-table";
import { VirtualTableV2 } from "@/features/data-table/data-table-v2";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import HeavyTable from "./features/data-table/data-table-v3";
import HeavyGrid from "./features/data-table/data-table-v4";
import UltraHeavyGrid from "./features/data-table/data-table-v5";
import ServerSideGrid from "./features/data-table/data-table-v6";
import HugeMatrixGrid from "./features/data-table/data-table-v7";
import DataTableV8 from "./features/data-table/data-table-v8";
import DataTableV9 from "./features/data-table/data-table-v9";
import DataTableV10 from "./features/data-table/data-table-v10";
import DataTableV11 from "./features/data-table/data-table-v11";
import DataTableV12 from "./features/data-table/data-table-v12";
import DataTableV13 from "./features/data-table/data-table-v13";
import DataTableV14 from "./features/data-table/data-table-v14";
import DataTableV10_1 from "./features/data-table/data-table-v10-1";
import DataTableV15 from "./features/data-table/data-table-v15";
import { TanstackDataTableV001 } from "./features/tanstack-data-table/tanstack-data-table-v001";
import { TanstackDataTableV002Container } from "./features/tanstack-data-table/tanstack-data-table-v002";
import { TanstackDataTableV003Container } from "./features/tanstack-data-table/tanstack-data-table-v003";
import { useState } from "react";

const queryClient = new QueryClient();
function App() {
  const components = [
    {
      label: "Table V1",
      component: <VirtualDataTable />,
    },
    {
      label: "Table V2",
      component: <VirtualTableV2 />,
    },
    {
      label: "Table V3",
      component: <HeavyTable />,
    },
    {
      label: "Table V4",
      component: <HeavyGrid />,
    },
    {
      label: "Table V5",
      component: <UltraHeavyGrid />,
    },
    {
      label: "Table V6",
      component: <ServerSideGrid />,
    },
    {
      label: "Table V7",
      component: <HugeMatrixGrid />,
    },
    {
      label: "Table V8",
      component: <DataTableV8 />,
    },
    {
      label: "Table V9",
      component: <DataTableV9 />,
    },
    {
      label: "Table V10",
      component: <DataTableV10 />,
    },
    {
      label: "Table V10_1",
      component: <DataTableV10_1 />,
    },
    {
      label: "Table V11",
      component: <DataTableV11 />,
    },
    {
      label: "Table V12",
      component: <DataTableV12 />,
    },
    {
      label: "Table V13",
      component: <DataTableV13 />,
    },
    {
      label: "Table V14",
      component: <DataTableV14 />,
    },
    {
      label: "Table V15",
      component: <DataTableV15 />,
    },
    {
      label: "Table V16",
      component: <TanstackDataTableV001 />,
    },
    {
      label: "Table V17",
      component: <TanstackDataTableV002Container />,
    },
    {
      label: "Table V18",
      component: <TanstackDataTableV003Container />,
    },
  ];

  return (
    <QueryClientProvider client={queryClient}>
      <Tabs>
        <TabsList>
          {components.map((component) => (
            <TabsTrigger key={component.label} value={component.label}>
              {component.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {components.map((component) => (
          <TabsContent
            key={component.label}
            value={component.label}
            className="p-8"
          >
            {component.component}
          </TabsContent>
        ))}
      </Tabs>
    </QueryClientProvider>
  );
}

export default App;
