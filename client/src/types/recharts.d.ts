/**
 * Type overrides for Recharts components
 *
 * Recharts types have React 18/19 compatibility issues due to different
 * ReactNode definitions between @types/react versions.
 *
 * This override fixes the JSX component type errors without using `any`.
 */

import type { ComponentType, ReactElement } from 'react';

declare module 'recharts' {
  // Re-export with fixed types
  export const ResponsiveContainer: ComponentType<{
    width?: string | number;
    height?: string | number;
    children?: ReactElement;
  }>;

  export const AreaChart: ComponentType<{
    data?: Array<Record<string, unknown>>;
    children?: ReactElement | ReactElement[];
  }>;

  export const XAxis: ComponentType<{
    dataKey?: string;
    hide?: boolean;
  }>;

  export const YAxis: ComponentType<{
    domain?: [number, number];
    hide?: boolean;
  }>;

  export const Area: ComponentType<{
    type?: string;
    dataKey?: string;
    stroke?: string;
    strokeWidth?: number;
    fill?: string;
  }>;

  export const Tooltip: ComponentType<{
    contentStyle?: React.CSSProperties;
    labelStyle?: React.CSSProperties;
    itemStyle?: React.CSSProperties;
    formatter?: (value: number) => [string, string];
  }>;
}
