"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Trigger loading when clicking navigation links
  useEffect(() => {
    function handleAnchorClick(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      const isExternal = target.getAttribute("target") === "_blank";
      const isAnchor = href?.startsWith("#");

      if (href && !isExternal && !isAnchor && href !== pathname) {
        setLoading(true);
        setProgress(30);
      }
    }

    document.addEventListener("click", handleAnchorClick);
    return () => document.removeEventListener("click", handleAnchorClick);
  }, [pathname]);

  // Animate progress when loading starts
  useEffect(() => {
    if (!loading) return;

    const timer1 = setTimeout(() => setProgress(65), 100);
    const timer2 = setTimeout(() => setProgress(85), 350);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [loading]);

  // Complete loading when pathname or searchParams change
  useEffect(() => {
    setProgress(100);
    const timer = setTimeout(() => {
      setLoading(false);
      setProgress(0);
    }, 200);
    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  if (!loading && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[9999] h-[2.5px] bg-transparent pointer-events-none"
    >
      <div
        className="h-full transition-all ease-out duration-200"
        style={{
          width: `${progress}%`,
          backgroundColor: "var(--theme-accent, #1E5AA8)",
          boxShadow: "0 0 8px var(--theme-accent, #1E5AA8)",
        }}
      />
    </div>
  );
}
