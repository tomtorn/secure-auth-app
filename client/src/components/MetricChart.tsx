/**
 * Simple metric visualization using Recharts
 * Uses real CloudWatch time-series data
 */

import { useId } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { MetricDataPoint } from '../hooks/useMonitoring';
import { Card } from './Card';

interface MetricChartProps {
  title: string;
  value: number;
  data: MetricDataPoint[];
  maxValue?: number;
  color?: string;
  unit?: string;
}

export const MetricChart = ({
  title,
  value,
  data,
  maxValue = 100,
  color = '#3b82f6',
  unit = '%',
}: MetricChartProps): JSX.Element => {
  const gradientId = useId();

  // Format data for chart - use real CloudWatch time-series
  const chartData =
    data.length > 0
      ? data.map((point) => ({
          time: new Date(point.timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          value: point.value,
        }))
      : [{ time: 'now', value }]; // Fallback to single point if no data

  // Calculate dynamic Y-axis domain based on data for better visualization
  const values = chartData.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const padding = Math.max((maxVal - minVal) * 0.2, 1); // 20% padding or at least 1
  const yMin = Math.max(0, Math.floor(minVal - padding));
  const yMax = Math.ceil(maxVal + padding);

  const percentage = Math.min((value / maxValue) * 100, 100);
  const isWarning = percentage > 70;
  const isCritical = percentage > 90;

  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <span
          className={`text-2xl font-bold ${
            isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-gray-900'
          }`}
        >
          {value.toFixed(1)}
          {unit}
        </span>
      </div>
      <div className="h-24 w-full min-w-[100px]">
        <ResponsiveContainer width="100%" height={96}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" hide />
            <YAxis domain={[yMin, yMax]} hide />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
              }}
              labelStyle={{ color: '#9ca3af' }}
              itemStyle={{ color: '#fff' }}
              formatter={(val: number) => [`${val.toFixed(1)}${unit}`, title]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};
