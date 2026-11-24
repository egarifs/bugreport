"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Trigger loading immediately when clicking navigation links
  useEffect(() => {
    function handleAnchorClick(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      const isExternal = target.getAttribute("target") === "_blank";
      const isAnchor = href?.startsWith("#");

      if (href && !isExternal && !isAnchor && href !== pathname) {
        setLoading(true);
        setProgress(35);
      }
    }

    document.addEventListener("click", handleAnchorClick);
    return () => document.removeEventListener("click", handleAnchorClick);
  }, [pathname]);

  // Smooth Android Material linear indicator progression
  useEffect(() => {
    if (!loading) return;

    const timer1 = setTimeout(() => setProgress(70), 80);
    const timer2 = setTimeout(() => setProgress(90), 250);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [loading]);

  // Complete and wipe smoothly on route resolved
  useEffect(() => {
    setProgress(100);
    const timer = setTimeout(() => {
      setLoading(false);
      setProgress(0);
    }, 180);
    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  if (!loading && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[9999] h-[2.5px] bg-slate-200/40 pointer-events-none"
    >
      <div
        className="h-full transition-all ease-[cubic-bezier(0.05,0.7,0.1,1.0)] duration-200"
        style={{
          width: `${progress}%`,
          backgroundColor: "rgb(var(--c-action))",
        }}
      />
    </div>
  );
}

