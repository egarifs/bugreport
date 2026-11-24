"use client";

import { usePathname } from "next/navigation";
import React from "react";

export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="android-shared-axis flex-1 flex flex-col min-w-0">
      {children}
    </div>
  );
}
