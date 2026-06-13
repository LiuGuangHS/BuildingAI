import { useEffect } from "react";

export function PwaLifecycle() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (!window.isSecureContext && window.location.hostname !== "localhost") return;

    let registration: ServiceWorkerRegistration | undefined;

    navigator.serviceWorker
      .register("/sw.js")
      .then((nextRegistration) => {
        registration = nextRegistration;
      })
      .catch(() => {
        // PWA should never block the app if registration fails.
      });

    return () => {
      void registration?.update();
    };
  }, []);

  return null;
}
