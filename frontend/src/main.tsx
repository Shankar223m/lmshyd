import "@/index.css";

import { MotionConfig } from "motion/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { reloadForNewVersion } from "@/shared/routing/staleBuild";
import { Provider } from "react-redux";
import { RouterProvider } from "react-router-dom";

import { router } from "@/app/router";
import { store } from "@/app/store";
import { SessionRestorer } from "@/modules/user-management/auth/guards/SessionRestorer";
import { Toaster } from "@/shared/ui";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

/** Jobs module (and other TanStack Query screens) require a client above the router. */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// A tab still on the previous release can fail to preload a page's file after an update: load the new release.
window.addEventListener("vite:preloadError", (event) => {
  if (reloadForNewVersion()) event.preventDefault();
});

createRoot(root).render(
  <StrictMode>
    {/* every animation honours the device's "reduce motion" setting */}
    <MotionConfig reducedMotion="user">
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <SessionRestorer>
          <RouterProvider router={router} />
        </SessionRestorer>
        <Toaster />
      </QueryClientProvider>
    </Provider>
    </MotionConfig>
  </StrictMode>,
);
