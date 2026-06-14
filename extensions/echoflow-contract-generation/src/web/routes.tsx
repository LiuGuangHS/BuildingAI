import { defineRouteOption } from "@buildingai/web-core";

import packageJson from "./../../package.json";
import ContractGenerationConfigPage from "./pages/console/config";
import ContractTasksConsolePage from "./pages/console/tasks";
import ContractTemplatesConsolePage from "./pages/console/templates";
import ContractGenerationHomePage from "./pages";

export const routeOption = defineRouteOption({
    base: `extension/${packageJson.name}`,
    identifier: packageJson.name,
    routes: [
        {
            index: true,
            element: <ContractGenerationHomePage />,
        },
    ],
    consoleMenus: [
        {
            title: "模型配置",
            path: "/",
            icon: "settings-2",
        },
        {
            title: "合同模板",
            path: "/templates",
            icon: "file-text",
        },
        {
            title: "生成任务",
            path: "/tasks",
            icon: "list-checks",
        },
    ],
    consoleRoutes: [
        {
            index: true,
            element: <ContractGenerationConfigPage />,
        },
        {
            path: "templates",
            element: <ContractTemplatesConsolePage />,
        },
        {
            path: "tasks",
            element: <ContractTasksConsolePage />,
        },
    ],
});
