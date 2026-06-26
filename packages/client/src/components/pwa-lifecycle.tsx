import { useEffect } from "react";
import { toast } from "sonner";

export function PwaLifecycle() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (!window.isSecureContext && window.location.hostname !== "localhost") return;

    let registration: ServiceWorkerRegistration | undefined;
    let updateToastShown = false;

    const showUpdateToast = () => {
      if (updateToastShown) return;
      updateToastShown = true;
      toast("新版本已就绪", {
        description: "刷新后即可生效。",
        action: {
          label: "刷新",
          onClick: () => window.location.reload(),
        },
      });
    };

    const watchInstallingWorker = (worker: ServiceWorker | null) => {
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          showUpdateToast();
        }
      });
    };

    const checkForUpdate = () => {
      void registration?.update();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") checkForUpdate();
    };

    navigator.serviceWorker
      .register("/sw.js")
      .then((nextRegistration) => {
        registration = nextRegistration;
        watchInstallingWorker(nextRegistration.installing);
        nextRegistration.addEventListener("updatefound", () => {
          watchInstallingWorker(nextRegistration.installing);
        });
        checkForUpdate();
      })
      .catch(() => {
        // PWA should never block the app if registration fails.
      });

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
