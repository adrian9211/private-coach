'use client'

import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import { Database } from '@/lib/supabase-types'

type Activity = Database['public']['Tables']['activities']['Row']

interface PowerCurveChartProps {
  activity: Activity
}

const DURATIONS_MAP = [
  { label: '1s', secs: 1 },
  { label: '5s', secs: 5 },
  { label: '15s', secs: 15 },
  { label: '30s', secs: 30 },
  { label: '1m', secs: 60 },
  { label: '2m', secs: 120 },
  { label: '5m', secs: 300 },
  { label: '10m', secs: 600 },
  { label: '20m', secs: 1200 },
  { label: '60m', secs: 3600 }
];

export function PowerCurveChart({ activity }: PowerCurveChartProps) {
  const curveData = useMemo(() => {
    const activityData = activity.data as any;
    const activityAny = activity as any;
    const gpsTrack = activityAny.gps_track || activityData?.gps_track || activityData?.records || [];

    if (!Array.isArray(gpsTrack) || gpsTrack.length < 5) return [];

    // Filter points to ensure they have timestamps and build a clean power array
    const track = gpsTrack
      .filter((p: any) => p && (p.timestamp || p.time))
      .sort((a: any, b: any) => {
        const timeA = new Date(a.timestamp || a.time).getTime();
        const timeB = new Date(b.timestamp || b.time).getTime();
        return timeA - timeB;
      });

    // Determine the sampling rate. Typically 1 point per second.
    // If we have gaps, this simplified algorithm treats array indices roughly as seconds.
    // For a highly accurate MMP curve with gaps, we interpolate to 1Hz first.
    // Here we will do a fast array-based computation heavily correlated to 1s ticks.
    
    // Convert to a strict 1Hz power array to calculate exact rolling averages
    const powerSeconds: number[] = [];
    if (track.length > 0) {
      const startTime = new Date(track[0].timestamp || track[0].time).getTime();
      const endTime = new Date(track[track.length - 1].timestamp || track[track.length - 1].time).getTime();
      const durationSeconds = Math.floor((endTime - startTime) / 1000) + 1;
      
      // Initialize with zeros
      for (let i = 0; i < durationSeconds; i++) {
        powerSeconds.push(0);
      }
      
      // Populate known values
      track.forEach((point: any) => {
        const time = new Date(point.timestamp || point.time).getTime();
        const secIndex = Math.floor((time - startTime) / 1000);
        if (secIndex >= 0 && secIndex < powerSeconds.length) {
          powerSeconds[secIndex] = point.power || 0;
        }
      });
    }

    // Now calculate Mean Maximal Power for each duration
    const results = [];
    for (const d of DURATIONS_MAP) {
      if (d.secs > powerSeconds.length) continue; // Skip durations longer than the ride
      
      let maxAvg = 0;
      let currentSum = 0;
      
      // Initial window sum
      for (let i = 0; i < d.secs; i++) {
        currentSum += powerSeconds[i];
      }
      maxAvg = currentSum / d.secs;
      
      // Slide the window
      for (let i = d.secs; i < powerSeconds.length; i++) {
        currentSum = currentSum + powerSeconds[i] - powerSeconds[i - d.secs];
        const avg = currentSum / d.secs;
        if (avg > maxAvg) {
          maxAvg = avg;
        }
      }
      
      if (maxAvg > 0) {
        results.push({
          durationLabel: d.label,
          secs: d.secs,
          watts: Math.round(maxAvg)
        });
      }
    }

    return results;

  }, [activity]);

  if (curveData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 text-center">
        <p className="text-gray-600">Insufficient power data to generate power curve</p>
      </div>
    );
  }

  // Custom visual tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 border border-gray-700 text-white p-3 rounded shadow-xl">
          <p className="font-semibold text-lg">{payload[0].value} Watts</p>
          <p className="text-gray-400 text-sm">Best {label}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Power Curve (Mean Maximal Power)</h2>
        <span className="text-sm text-gray-500">Peak wattage over specific durations</span>
      </div>

      <div className="h-[350px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={curveData}
            margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis 
              dataKey="durationLabel" 
              tick={{ fill: '#6B7280', fontSize: 12 }} 
              tickLine={false} 
              axisLine={{ stroke: '#E5E7EB' }} 
              dy={10}
            />
            <YAxis 
              tick={{ fill: '#6B7280', fontSize: 12 }} 
              tickLine={false} 
              axisLine={false} 
              dx={-10}
              domain={['auto', 'auto']}
              tickFormatter={(value) => `${value}W`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#6366F1', strokeWidth: 1, strokeDasharray: '4 4' }} />
            <Line
              type="monotone"
              dataKey="watts"
              stroke="#6366F1"
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#6366F1' }}
              activeDot={{ r: 6, fill: '#6366F1', stroke: '#fff', strokeWidth: 2 }}
              animationDuration={1500}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
