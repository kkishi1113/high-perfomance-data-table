import "./App.css";
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
import { DataGridDemo } from "./features/data-grid/DataGridDemo";
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
  ];

  const dataGrid = [
    {
      label: "Data Grid V1",
      component: <DataGridDemo />,
    },
    {
      label: "Data Grid V2",
      component: <DataGridDemo />,
    }
  ];

  return (
    <>
      <Tabs>
        <TabsList>
          {dataGrid.map((component) => (
            <TabsTrigger key={component.label} value={component.label}>
              {component.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {dataGrid.map((component) => (
          <TabsContent
            key={component.label}
            value={component.label}
            className="p-8"
          >
            {component.component}
          </TabsContent>
        ))}
      </Tabs>
      {/* <Tabs>
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
      </Tabs> */}
    </>
  );
}

export default App;
