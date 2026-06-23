import AuthGuard from "@buildingai/ui/components/auth/auth-guard";
import { Button } from "@buildingai/ui/components/ui/button";
import type { ExtensionMenuItem } from "@buildingai/ui/layouts/extension/console/types";
import { lazy, Suspense, useEffect, useRef } from "react";
import {
    createBrowserRouter,
    Outlet,
    useLocation,
    useNavigate,
} from "react-router-dom";

import packageJson from "./../../package.json";

const TownIndexPage = lazy(() => import("./pages/index"));
const ExtensionConsoleLayout = lazy(() => import("@buildingai/ui/layouts/extension/console/index"));
const TownConsolePage = lazy(() => import("./pages/console/saves/list"));
const TownAiConfigPage = lazy(() => import("./pages/console/ai-config"));
const TownContentPackPage = lazy(() => import("./pages/console/content-pack"));

function LazyPage({ children }: { children: React.ReactNode }) {
    return <Suspense fallback={<RouteLoading />}>{children}</Suspense>;
}

function RouteLoading() {
    return (
        <div className="town-route-loading" role="status" aria-live="polite">
            <span className="town-route-loading-dot" />
            <span>读取街区中</span>
        </div>
    );
}

function TownRouteError() {
    const navigate = useNavigate();

    return (
        <div className="town-route-error">
            <h1>页面暂时不可达</h1>
            <p>请返回小镇主场景，或刷新后再试。</p>
            <div className="town-route-error-actions">
                <Button type="button" variant="default" onClick={() => navigate("/")}>
                    返回小镇
                </Button>
                <Button type="button" variant="outline" onClick={() => window.location.reload()}>
                    重读小镇
                </Button>
            </div>
        </div>
    );
}

function ParentFrameSync() {
    const location = useLocation();
    const navigate = useNavigate();
    const isParentNavigatingRef = useRef(false);

    useEffect(() => {
        if (window.parent === window) return;
        if (isParentNavigatingRef.current) {
            isParentNavigatingRef.current = false;
            return;
        }

        window.parent.postMessage(
            {
                type: "extension-navigate",
                path: location.pathname,
                search: location.search,
                hash: location.hash,
            },
            "*",
        );
    }, [location.hash, location.pathname, location.search]);

    useEffect(() => {
        if (window.parent === window) return;

        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type !== "parent-navigate") return;

            const path = event.data.path ?? "/";
            const search = event.data.search ?? "";
            const hash = event.data.hash ?? "";
            const target = `${path}${search}${hash}`;
            const current = `${location.pathname}${location.search}${location.hash}`;

            if (target !== current) {
                isParentNavigatingRef.current = true;
                navigate(target, { replace: true });
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [location.hash, location.pathname, location.search, navigate]);

    return <Outlet />;
}

function TownNotFoundPage() {
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        if (window.parent === window) return;

        window.parent.postMessage(
            {
                type: "extension-not-found",
                path: location.pathname,
                search: location.search,
                hash: location.hash,
            },
            "*",
        );
    }, [location.hash, location.pathname, location.search]);

    return (
        <div className="town-route-error">
            <h1>页面走丢了</h1>
            <p>这条路暂时还没有开放。</p>
            <div className="town-route-error-actions">
                <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                    上一页
                </Button>
                <Button type="button" variant="default" onClick={() => navigate("/")}>
                    返回小镇
                </Button>
            </div>
        </div>
    );
}

const consoleMenus: ExtensionMenuItem[] = [
    {
        title: "小镇存档",
        path: "/",
        icon: "landmark",
    },
    {
        title: "AI 配置",
        path: "/ai-config",
        icon: "bot",
    },
    {
        title: "内容包",
        path: "/content-pack",
        icon: "list-checks",
    },
];

function ConsoleLayoutRoute() {
    return (
        <LazyPage>
            <ExtensionConsoleLayout menus={consoleMenus} identifier={packageJson.name} />
        </LazyPage>
    );
}

function ConsoleErrorRoute() {
    return (
        <LazyPage>
            <ExtensionConsoleLayout menus={consoleMenus} identifier={packageJson.name}>
                <TownRouteError />
            </ExtensionConsoleLayout>
        </LazyPage>
    );
}

export const routeOption = createBrowserRouter(
    [
        {
            element: <ParentFrameSync />,
            errorElement: <TownRouteError />,
            children: [
                {
                    index: true,
                    element: <LazyPage><TownIndexPage /></LazyPage>,
                },
                {
                    element: <AuthGuard />,
                    children: [
                        {
                            path: "/console/*",
                            element: <ConsoleLayoutRoute />,
                            errorElement: <ConsoleErrorRoute />,
                            children: [
                                {
                                    index: true,
                                    element: <LazyPage><TownConsolePage /></LazyPage>,
                                },
                                {
                                    path: "ai-config",
                                    element: <LazyPage><TownAiConfigPage /></LazyPage>,
                                },
                                {
                                    path: "content-pack",
                                    element: <LazyPage><TownContentPackPage /></LazyPage>,
                                },
                            ],
                        },
                    ],
                },
                {
                    path: "*",
                    element: <TownNotFoundPage />,
                },
            ],
        },
    ],
    {
        basename: `extension/${packageJson.name}`,
    },
);
