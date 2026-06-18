import { defineRouteOption } from "@buildingai/web-core";

import packageJson from "./../../package.json";
import WebDetailPage from "./pages/detail";
import WebHistoryPage from "./pages/history";
import ConsoleDetailPage from "./pages/console/detail";
import ConsoleHistoryPage from "./pages/console/history";
import EchoflowImageConsolePage from "./pages/console/index";
import ConsoleModelsPage from "./pages/console/models";
import ConsolePoliciesPage from "./pages/console/policies";
import ConsoleTemplatesPage from "./pages/console/templates";
import EchoflowImagePublicPage from "./pages/index";

export const routeOption = defineRouteOption({
    base: `extension/${packageJson.name}`,
    identifier: packageJson.name,
    routes: [
        {
            index: true,
            element: <EchoflowImagePublicPage />,
        },
        {
            path: "history",
            element: <WebHistoryPage />,
        },
        {
            path: "history/:id",
            element: <WebDetailPage />,
        },
    ],
    consoleMenus: [
        {
            title: "运营概览",
            path: "/",
            icon: "bar-chart-3",
        },
        {
            title: "模型配置",
            path: "/models",
            icon: "settings-2",
        },
        {
            title: "风控限流",
            path: "/policies",
            icon: "shield",
        },
        {
            title: "模板预设",
            path: "/templates",
            icon: "sparkles",
        },
        {
            title: "生成历史",
            path: "/history",
            icon: "history",
        },
    ],
    consoleRoutes: [
        {
            index: true,
            element: <EchoflowImageConsolePage />,
        },
        {
            path: "models",
            element: <ConsoleModelsPage />,
        },
        {
            path: "policies",
            element: <ConsolePoliciesPage />,
        },
        {
            path: "templates",
            element: <ConsoleTemplatesPage />,
        },
        {
            path: "history",
            element: <ConsoleHistoryPage />,
        },
        {
            path: "history/:id",
            element: <ConsoleDetailPage />,
        },
    ],
});
