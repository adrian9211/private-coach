'use client'

import { useMemo, useState } from 'react'
import { Database } from '@/lib/supabase-types'

type Activity = Database['public']['Tables']['activities']['Row']

interface PowerZoneAnalysisProps {
  activity: Activity
  ftp?: number | null
}

interface ZoneTime {
  zone: string
  name: string
  minVal: number
  maxVal: number
  timeSeconds: number
  percentage: number
  color: string
}

const POWER_ZONE_NAMES = [
  'Active Recovery', 'Endurance', 'Tempo', 'Threshold', 
  'VO2max', 'Anaerobic', 'Neuromuscular'
]
const POWER_COLORS = ['#D1FAE5', '#E0F2FE', '#FDE68A', '#FECACA', '#E9D5FF', '#FBCFE8', '#ffe4e6']

const HR_ZONE_NAMES = [
  'Recovery', 'Aerobic', 'Tempo', 'SubThreshold', 
  'SuperThreshold', 'Aerobic Capacity', 'Anaerobic'
]
const HR_COLORS = ['#E0F2FE', '#D1FAE5', '#FDE68A', '#fdba74', '#f43f5e', '#a855f7', '#1e1b4b']

export function PowerZoneAnalysis({ activity, ftp }: PowerZoneAnalysisProps) {
  const [activeTab, setActiveTab] = useState<'power' | 'hr'>('power')

  const activityData = activity.data as any
  const activityAny = activity as any
  const gpsTrack = activityAny.gps_track || activityData?.gps_track || activityData?.records || []

  // EXTRACT NATIVE INTERVALS OR FALLBACK TO MANUAL POWER
  const powerZonesData = useMemo(() => {
    // 1. Try to extract native intervals
    const nativeLabels = activityAny.power_zones || activityData?.summary?.powerZones;
    const nativeTimes = activityAny.power_zone_times || activityData?.summary?.powerZoneTimes;

    if (nativeLabels && nativeTimes && nativeLabels.length > 0) {
      const zones: ZoneTime[] = [];
      const totalTime = nativeTimes.reduce((a: number, b: any) => a + (b?.secs || b || 0), 0);
      if (totalTime === 0) return null;

      let previousLimit = 0;
      for (let i = 0; i < Math.min(nativeLabels.length, 7); i++) {
        const timeSecs = typeof nativeTimes[i] === 'object' ? nativeTimes[i].secs : nativeTimes[i];
        zones.push({
          zone: `Z${i + 1}`,
          name: POWER_ZONE_NAMES[i] || `Zone ${i + 1}`,
          minVal: previousLimit + (i > 0 ? 1 : 0),
          maxVal: nativeLabels[i],
          timeSeconds: timeSecs || 0,
          percentage: totalTime > 0 ? ((timeSecs || 0) / totalTime) * 100 : 0,
          color: POWER_COLORS[i] || '#ccc'
        });
        previousLimit = nativeLabels[i];
      }
      return zones.filter(z => z.timeSeconds > 0);
    }

    // 2. Fallback to manual computation if FTP exists
    if (!ftp || !Array.isArray(gpsTrack) || gpsTrack.length < 2) return null;

    const ftpPercents = [55, 75, 90, 105, 120, 150, 300];
    const limits = ftpPercents.map(p => Math.round(ftp * p / 100));
    
    const zoneTotals: Record<number, number> = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 };
    let totalTime = 0;

    const track = gpsTrack.filter((p: any) => p && (p.timestamp || p.time))
      .sort((a,b) => new Date(a.timestamp || a.time).getTime() - new Date(b.timestamp || b.time).getTime());

    for (let i = 1; i < track.length; i++) {
      const dt = (new Date(track[i].timestamp || track[i].time).getTime() - new Date(track[i-1].timestamp || track[i-1].time).getTime()) / 1000;
      if (!isFinite(dt) || dt <= 0 || dt > 300) continue;
      const power = track[i-1].power || 0;
      if (power > 0) {
        const zi = limits.findIndex(l => power <= l);
        const zoneIndex = zi === -1 ? 6 : zi;
        zoneTotals[zoneIndex] += dt;
        totalTime += dt;
      }
    }

    if (totalTime === 0) return null;

    const zones: ZoneTime[] = [];
    let previousLimit = 0;
    for (let i = 0; i < 7; i++) {
      zones.push({
        zone: `Z${i + 1}`,
        name: POWER_ZONE_NAMES[i],
        minVal: previousLimit + (i > 0 ? 1 : 0),
        maxVal: limits[i],
        timeSeconds: zoneTotals[i],
        percentage: (zoneTotals[i] / totalTime) * 100,
        color: POWER_COLORS[i]
      });
      previousLimit = limits[i];
    }
    return zones.filter(z => z.timeSeconds > 0);

  }, [activityAny, activityData, ftp, gpsTrack]);


  // EXTRACT NATIVE INTERVALS OR FALLBACK TO MANUAL HR
  const hrZonesData = useMemo(() => {
    const nativeLabels = activityAny.hr_zones || activityData?.summary?.hrZones;
    const nativeTimes = activityAny.hr_zone_times || activityData?.summary?.hrZoneTimes;

    if (nativeLabels && nativeTimes && nativeLabels.length > 0) {
      const zones: ZoneTime[] = [];
      const totalTime = nativeTimes.reduce((a: number, b: number) => a + (b || 0), 0);
      if (totalTime === 0) return null;

      let previousLimit = 0;
      for (let i = 0; i < Math.min(nativeLabels.length, 7); i++) {
        zones.push({
          zone: `Z${i + 1}`,
          name: HR_ZONE_NAMES[i] || `Zone ${i + 1}`,
          minVal: previousLimit + (i > 0 ? 1 : 0),
          maxVal: nativeLabels[i],
          timeSeconds: nativeTimes[i] || 0,
          percentage: totalTime > 0 ? ((nativeTimes[i] || 0) / totalTime) * 100 : 0,
          color: HR_COLORS[i] || '#ccc'
        });
        previousLimit = nativeLabels[i];
      }
      return zones.filter(z => z.timeSeconds > 0);
    }

    // 2. Fallback manual HR
    if (!Array.isArray(gpsTrack) || gpsTrack.length < 2) return null;
    
    // Estimate LTHR if none provided (simplified fallbacks for rendering if no intervals payload exists)
    const maxHR = activityData?.summary?.maxHeartRate || activityAny.max_heart_rate || 190;
    const lthr = activityData?.summary?.lthr || activityAny.lthr || Math.round(maxHR * 0.9);
    
    const limits = [
      Math.round(lthr * 0.8),    // Z1 Recovery
      Math.round(lthr * 0.89),   // Z2 Aerobic
      Math.round(lthr * 0.93),   // Z3 Tempo
      Math.round(lthr * 0.99),   // Z4 SubThreshold
      Math.round(lthr * 1.02),   // Z5 SuperThreshold
      Math.round(lthr * 1.05),   // Z6 Aerobic Capacity
      999                        // Z7 Anaerobic
    ];

    const zoneTotals: Record<number, number> = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 };
    let totalTime = 0;

    const track = gpsTrack.filter((p: any) => p && (p.timestamp || p.time))
      .sort((a,b) => new Date(a.timestamp || a.time).getTime() - new Date(b.timestamp || b.time).getTime());

    for (let i = 1; i < track.length; i++) {
      const dt = (new Date(track[i].timestamp || track[i].time).getTime() - new Date(track[i-1].timestamp || track[i-1].time).getTime()) / 1000;
      if (!isFinite(dt) || dt <= 0 || dt > 300) continue;
      const hr = track[i-1].heartRate || 0;
      if (hr > 0) {
        const zi = limits.findIndex(l => hr <= l);
        const zoneIndex = zi === -1 ? 6 : zi;
        zoneTotals[zoneIndex] += dt;
        totalTime += dt;
      }
    }

    if (totalTime === 0) return null;
    
    const zones: ZoneTime[] = [];
    let previousLimit = 0;
    for (let i = 0; i < 7; i++) {
      zones.push({
        zone: `Z${i + 1}`,
        name: HR_ZONE_NAMES[i],
        minVal: previousLimit + (i > 0 ? 1 : 0),
        maxVal: limits[i],
        timeSeconds: zoneTotals[i],
        percentage: (zoneTotals[i] / totalTime) * 100,
        color: HR_COLORS[i]
      });
      previousLimit = limits[i];
    }
    return zones.filter(z => z.timeSeconds > 0);

  }, [activityAny, activityData, gpsTrack]);


  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}m ${secs}s`
  }

  const currentZoneData = activeTab === 'power' ? powerZonesData : hrZonesData;

  // Render classifications only for Power
  const aggregatedZones = useMemo(() => {
    if (!powerZonesData) return null;
    const z1z2 = powerZonesData.filter(z => z.zone === 'Z1' || z.zone === 'Z2').reduce((sum, z) => sum + z.percentage, 0)
    const z3z4 = powerZonesData.filter(z => z.zone === 'Z3' || z.zone === 'Z4').reduce((sum, z) => sum + z.percentage, 0)
    const z5plus = powerZonesData.filter(z => ['Z5', 'Z6', 'Z7'].includes(z.zone)).reduce((sum, z) => sum + z.percentage, 0)
    const base = (z3z4 + z5plus) > 0 ? (z1z2 / (z3z4 + z5plus)) : (z1z2 > 0 ? 999 : 0)
    return { z1z2, z3z4, z5plus, base }
  }, [powerZonesData])

  const classifications = useMemo(() => {
    if (!aggregatedZones) return [];
    return [
      { name: 'Polarized', z1z2: 80, z3z4: 5, z5plus: 15 },
      { name: 'Pyramidal', z1z2: 75, z3z4: 20, z5plus: 5 },
      { name: 'Threshold', z1z2: 50, z3z4: 40, z5plus: 10 },
      { name: 'HIIT', z1z2: 50, z3z4: 10, z5plus: 40 },
      { name: 'Unique', z1z2: aggregatedZones.z1z2, z3z4: aggregatedZones.z3z4, z5plus: aggregatedZones.z5plus }
    ].map(c => {
      const distance = Math.sqrt(Math.pow(aggregatedZones.z1z2 - c.z1z2, 2) + Math.pow(aggregatedZones.z3z4 - c.z3z4, 2) + Math.pow(aggregatedZones.z5plus - c.z5plus, 2))
      return { ...c, match: Math.max(0, 100 - (distance * 2)) }
    }).sort((a,b) => b.match - a.match)
  }, [aggregatedZones])

  if (!powerZonesData && !hrZonesData) return null;

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 space-y-6">
      
      {/* TABS HEADER */}
      <div className="flex border-b border-gray-200">
        {powerZonesData && (
          <button 
            className={`py-3 px-6 text-sm font-semibold transition hover:bg-gray-50 focus:outline-none ${activeTab === 'power' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('power')}
          >
            POWER ZONES
          </button>
        )}
        {hrZonesData && (
          <button 
            className={`py-3 px-6 text-sm font-semibold transition hover:bg-gray-50 focus:outline-none ${activeTab === 'hr' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab('hr')}
          >
            HEART RATE ZONES
          </button>
        )}
      </div>

      {/* TABLE DATA */}
      {currentZoneData && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 text-gray-700 font-semibold">Zone</th>
                <th className="text-left py-2 px-3 text-gray-700 font-semibold">Name</th>
                <th className="text-right py-2 px-3 text-gray-700 font-semibold">Range</th>
                <th className="text-right py-2 px-3 text-gray-700 font-semibold">Time</th>
                <th className="text-right py-2 px-3 text-gray-700 font-semibold">%</th>
              </tr>
            </thead>
            <tbody>
              {currentZoneData.map((zone) => (
                <tr key={zone.zone} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-3"><span className="font-medium text-gray-900">{zone.zone}</span></td>
                  <td className="py-3 px-3"><span className="text-gray-700">{zone.name}</span></td>
                  <td className="py-3 px-3 text-right text-gray-600">
                    {zone.minVal} - {zone.maxVal > 900 ? '∞' : `${zone.maxVal}`} {activeTab === 'power' ? 'W' : 'bpm'}
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-4 rounded" style={{ width: `${Math.max(zone.percentage * 4, 20)}px`, backgroundColor: zone.color, minWidth: '20px' }} />
                      <span className="text-gray-700">{formatDuration(zone.timeSeconds)}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right"><span className="font-medium text-gray-900">{zone.percentage.toFixed(1)}%</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CLASSIFICATIONS (Only for Power) */}
      {activeTab === 'power' && aggregatedZones && aggregatedZones.z1z2 + aggregatedZones.z3z4 > 0 && (
        <div className="mt-8 border-t border-gray-100 pt-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wider">Scientific Classification Match</h3>
          <div className="space-y-3">
            {classifications.slice(0, 3).map((c) => (
              <div key={c.name} className="flex items-center gap-4 text-sm bg-gray-50 p-3 rounded-lg">
                <div className="w-24 font-medium text-gray-700">{c.name}</div>
                <div className="flex-1 flex h-4 rounded-full overflow-hidden opacity-90">
                  <div className="bg-green-500" style={{ width: `${(c.z1z2 / 100) * 100}%` }} title={`Low: ${c.z1z2}%`} />
                  <div className="bg-orange-500" style={{ width: `${(c.z3z4 / 100) * 100}%` }} title={`Mid: ${c.z3z4}%`} />
                  <div className="bg-red-500" style={{ width: `${(c.z5plus / 100) * 100}%` }} title={`High: ${c.z5plus}%`} />
                </div>
                <div className="text-xs font-semibold px-2 py-1 bg-white rounded shadow-sm whitespace-nowrap">
                  {c.name === 'Unique' ? 'Your Output' : `${Math.round(c.match)}% Match`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
