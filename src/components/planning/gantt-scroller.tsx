"use client";

import { useEffect, useRef } from "react";

type Props = { offset: number; children: React.ReactNode };

/** Диаграмма открывается на текущей неделе, а не на январе 2026-го. */
export function GanttScroller({ offset, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollLeft = Math.max(0, offset);
  }, [offset]);
  return (
    <div ref={ref} className="card overflow-x-auto">
      {children}
    </div>
  );
}
