import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/schools")({
  beforeLoad: () => {
    throw redirect({ to: "/login", replace: true });
  },
  component: () => null,
});
