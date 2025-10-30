'use client'

import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, ReferenceArea, ReferenceLine } from 'recharts'

interface GPSPoint {
  timestamp: string
  lat: number
  long: number
  distance?: number
  speed?: number
  heartRate?: number
  power?: number
  cadence?: number
  altitude?: number
  temperature?: number
  grade?: number
  resistance?: number
}

interface Activity {
  id: string
  file_name: string
  gps_track: GPSPoint[]
  sport?: string
  start_time?: string
}

interface ElevationProfileProps {
  activity: Activity
  ftp?: number
}

interface ChartDataPoint {
  distance: number
  altitude: number
  speed: number
  heartRate: number
  power: number
  cadence: number
  grade: number
  time: string
}

export function ElevationProfile({ activity, ftp }: ElevationProfileProps) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [stats, setStats] = useState({
    totalAscent: 0,
    totalDescent: 0,
    maxAltitude: 0,
    minAltitude: 0,
    avgGrade: 0
  })

  const powerZones = ftp ? [
    { key: 'Z1', label: 'Active Recovery', min: 0, max: Math.round(ftp * 0.55), color: '#D1FAE5' },
    { key: 'Z2', label: 'Endurance', min: Math.round(ftp * 0.56), max: Math.round(ftp * 0.75), color: '#E0F2FE' },
    { key: 'Z3', label: 'Tempo', min: Math.round(ftp * 0.76), max: Math.round(ftp * 0.90), color: '#FDE68A' },
    { key: 'Z4', label: 'Threshold', min: Math.round(ftp * 0.91), max: Math.round(ftp * 1.05), color: '#FECACA' },
    { key: 'Z5', label: 'VO2max', min: Math.round(ftp * 1.06), max: Math.round(ftp * 1.20), color: '#E9D5FF' },
    { key: 'Z6', label: 'Anaerobic', min: Math.round(ftp * 1.21), max: Math.round(ftp * 1.50), color: '#FBCFE8' },
    { key: 'Z7', label: 'Neuromuscular', min: Math.round(ftp * 1.51), max: Math.round(ftp * 3.00), color: '#FFE4E6' },
  ] : null

  useEffect(() => {
    if (!activity.gps_track || activity.gps_track.length === 0) return

    const validPoints = activity.gps_track.filter(point => 
      point.altitude !== null && 
      point.altitude !== undefined && 
      point.distance !== null && 
      point.distance !== undefined
    )

    if (validPoints.length === 0) return

    // Convert distance from meters to kilometers and prepare chart data
    const data: ChartDataPoint[] = validPoints.map((point, index) => ({
      distance: (point.distance || 0) / 1000, // Convert to km
      altitude: point.altitude || 0,
      speed: point.speed ? (point.speed * 3.6) : 0, // Convert to km/h
      heartRate: point.heartRate || 0,
      power: point.power || 0,
      cadence: point.cadence || 0,
      grade: point.grade || 0,
      time: new Date(point.timestamp).toLocaleTimeString()
    }))

    setChartData(data)

    // Calculate elevation statistics
    const altitudes = validPoints.map(p => p.altitude || 0)
    const maxAltitude = Math.max(...altitudes)
    const minAltitude = Math.min(...altitudes)
    
    // Calculate total ascent and descent
    let totalAscent = 0
    let totalDescent = 0
    
    for (let i = 1; i < validPoints.length; i++) {
      const prevAlt = validPoints[i - 1].altitude || 0
      const currAlt = validPoints[i].altitude || 0
      const diff = currAlt - prevAlt
      
      if (diff > 0) {
        totalAscent += diff
      } else {
        totalDescent += Math.abs(diff)
      }
    }

    // Calculate average grade
    const grades = validPoints.map(p => p.grade || 0).filter(g => g !== 0)
    const avgGrade = grades.length > 0 ? grades.reduce((sum, grade) => sum + grade, 0) / grades.length : 0

    setStats({
      totalAscent: Math.round(totalAscent),
      totalDescent: Math.round(totalDescent),
      maxAltitude: Math.round(maxAltitude),
      minAltitude: Math.round(minAltitude),
      avgGrade: Math.round(avgGrade * 10) / 10
    })
  }, [activity.gps_track])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border border-gray-300 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-800">Distance: {label.toFixed(2)} km</p>
          <p className="text-blue-600">Altitude: {data.altitude.toFixed(0)} m</p>
          <p className="text-green-600">Speed: {data.speed.toFixed(1)} km/h</p>
          {data.heartRate > 0 && <p className="text-red-600">Heart Rate: {data.heartRate} bpm</p>}
          {data.power > 0 && <p className="text-purple-600">Power: {data.power} W</p>}
          {data.grade !== 0 && <p className="text-orange-600">Grade: {data.grade.toFixed(1)}%</p>}
          <p className="text-gray-500 text-sm">Time: {data.time}</p>
        </div>
      )
    }
    return null
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">
          Elevation Profile - {activity.file_name}
        </h3>
        <div className="text-center py-8 text-gray-600">
          No elevation data available for this activity.
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-semibold text-gray-900 mb-4">
        Elevation Profile - {activity.file_name}
      </h3>

      {/* Elevation Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="text-sm text-blue-600 font-medium">Total Ascent</div>
          <div className="text-lg font-bold text-blue-800">{stats.totalAscent} m</div>
        </div>
        <div className="bg-red-50 p-3 rounded-lg">
          <div className="text-sm text-red-600 font-medium">Total Descent</div>
          <div className="text-lg font-bold text-red-800">{stats.totalDescent} m</div>
        </div>
        <div className="bg-green-50 p-3 rounded-lg">
          <div className="text-sm text-green-600 font-medium">Max Altitude</div>
          <div className="text-lg font-bold text-green-800">{stats.maxAltitude} m</div>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-sm text-gray-600 font-medium">Min Altitude</div>
          <div className="text-lg font-bold text-gray-800">{stats.minAltitude} m</div>
        </div>
        <div className="bg-purple-50 p-3 rounded-lg">
          <div className="text-sm text-purple-600 font-medium">Avg Grade</div>
          <div className="text-lg font-bold text-purple-800">{stats.avgGrade}%</div>
        </div>
      </div>

      {/* Elevation Chart */}
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <defs>
              <linearGradient id="elevationGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis 
              dataKey="distance" 
              stroke="#6B7280"
              fontSize={12}
              tickFormatter={(value) => `${value.toFixed(1)} km`}
            />
            <YAxis 
              stroke="#6B7280"
              fontSize={12}
              tickFormatter={(value) => `${value}m`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="altitude"
              stroke="#3B82F6"
              strokeWidth={2}
              fill="url(#elevationGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Additional Charts */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Speed Profile */}
        <div>
          <h4 className="text-lg font-medium text-gray-800 mb-3">Speed Profile</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis 
                  dataKey="distance" 
                  stroke="#6B7280"
                  fontSize={12}
                  tickFormatter={(value) => `${value.toFixed(1)} km`}
                />
                <YAxis 
                  stroke="#6B7280"
                  fontSize={12}
                  tickFormatter={(value) => `${value.toFixed(0)} km/h`}
                />
                <Tooltip 
                  formatter={(value: any) => [`${value.toFixed(1)} km/h`, 'Speed']}
                  labelFormatter={(label) => `Distance: ${label.toFixed(2)} km`}
                />
                <Line 
                  type="monotone" 
                  dataKey="speed" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Heart Rate Profile */}
        <div>
          <h4 className="text-lg font-medium text-gray-800 mb-3">Heart Rate Profile</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData.filter(d => d.heartRate > 0)} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis 
                  dataKey="distance" 
                  stroke="#6B7280"
                  fontSize={12}
                  tickFormatter={(value) => `${value.toFixed(1)} km`}
                />
                <YAxis 
                  stroke="#6B7280"
                  fontSize={12}
                  tickFormatter={(value) => `${value} bpm`}
                />
                <Tooltip 
                  formatter={(value: any) => [`${value} bpm`, 'Heart Rate']}
                  labelFormatter={(label) => `Distance: ${label.toFixed(2)} km`}
                />
                <Line 
                  type="monotone" 
                  dataKey="heartRate" 
                  stroke="#EF4444" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Power Profile */}
        <div>
          <h4 className="text-lg font-medium text-gray-800 mb-3">Power Profile</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData.filter(d => d.power > 0)} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis 
                  dataKey="distance" 
                  stroke="#6B7280"
                  fontSize={12}
                  tickFormatter={(value) => `${value.toFixed(1)} km`}
                />
                <YAxis 
                  stroke="#6B7280"
                  fontSize={12}
                  tickFormatter={(value) => `${value} W`}
                />
                <Tooltip 
                  formatter={(value: any) => [`${Math.round(value as number)} W`, 'Power']}
                  labelFormatter={(label) => `Distance: ${label.toFixed(2)} km`}
                />
                {ftp && powerZones && powerZones.map(zone => (
                  <ReferenceArea key={zone.key} y1={zone.min} y2={zone.max} strokeOpacity={0} fill={zone.color} fillOpacity={0.35} />
                ))}
                {ftp && (
                  <ReferenceLine y={ftp} stroke="#7C3AED" strokeDasharray="4 4" label={{ position: 'right', value: `FTP ${ftp}W`, fill: '#7C3AED', fontSize: 12 }} />
                )}
                <Line 
                  type="monotone" 
                  dataKey="power" 
                  stroke="#8B5CF6" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {ftp && powerZones && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              {powerZones.map(z => (
                <div key={z.key} className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: z.color }} />
                  <span className="text-gray-700 font-medium">{z.key}</span>
                  <span className="text-gray-500">{z.label} ({z.min}-{z.max} W)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chart Info */}
      <div className="mt-6 text-sm text-gray-600">
        <p><strong>Chart Features:</strong></p>
        <ul className="list-disc list-inside ml-4">
          <li>Interactive hover tooltips with detailed data</li>
          <li>Distance-based x-axis (kilometers)</li>
          <li>Elevation profile with gradient fill</li>
          <li>Speed, heart rate, and power profiles</li>
          <li>Responsive design for all screen sizes</li>
        </ul>
      </div>
    </div>
  )
}
