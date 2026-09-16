import type { ReactNode } from "react";

export default function PullToRefresh({ children }: { children: ReactNode; onRefresh?: () => void }) {
  return <>{children}</>;
}
