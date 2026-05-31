import type { RouterHistory } from "@tanstack/react-router";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";

import { routeTree } from "./routeTree.gen";

export function getRouter(history?: RouterHistory) {
  const queryClient = new QueryClient();

  return createTanStackRouter({
    context: { queryClient },
    history,
    routeTree,
    scrollRestoration: true,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
