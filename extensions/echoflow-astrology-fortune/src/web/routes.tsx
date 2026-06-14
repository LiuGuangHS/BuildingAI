import { defineRouteOption } from "@buildingai/web-core";

import packageJson from "./../../package.json";
import AstrologyFortuneConsolePage from "./pages/console";
import AstrologyFortuneHomePage from "./pages";

export const routeOption = defineRouteOption({
    base: `extension/${packageJson.name}`,
    identifier: packageJson.name,
    routes: [
        {
            index: true,
            element: <AstrologyFortuneHomePage />,
        },
    ],
    consoleMenus: [
        {
            title: "运势看板",
            path: "/",
            icon: "sparkles",
        },
    ],
    consoleRoutes: [
        {
            index: true,
            element: <AstrologyFortuneConsolePage />,
        },
    ],
});
