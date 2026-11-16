"use client";

import dynamic from "next/dynamic";

/**
 * Recharts is a large client dependency and is only used on the overview.
 * Loading it after the page shell keeps route transitions and hydration small.
 */
export const TrendChartLazy = dynamic(
  () => import("./trend-chart").then((m) => m.TrendChart),
  {
    ssr: false,
    loading: () => <div aria-hidden className="h-56 w-full animate-pulse rounded-md bg-surface-2" />,
  },
);
