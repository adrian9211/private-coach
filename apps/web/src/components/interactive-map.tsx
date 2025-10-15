'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import the entire map component to avoid SSR issues
const DynamicMap = dynamic(() => import('./map-component'), { 
  ssr: false,
  loading: () => <div className="h-96 bg-gray-200 rounded-lg animate-pulse"></div>
})

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

interface InteractiveMapProps {
  activity: Activity
}

export function InteractiveMap({ activity }: InteractiveMapProps) {
  const [isClient, setIsClient] = useState(false)
  const [mapCenter, setMapCenter] = useState<[number, number]>([0, 0])
  const [routePoints, setRoutePoints] = useState<[number, number][]>([])
  const [startPoint, setStartPoint] = useState<[number, number] | null>(null)
  const [endPoint, setEndPoint] = useState<[number, number] | null>(null)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (activity.gps_track && activity.gps_track.length > 0) {
      const validPoints = activity.gps_track.filter(point => point.lat && point.long)
      
      if (validPoints.length > 0) {
        // Convert coordinates
        const convertedPoints = validPoints.map(point => {
          const latDegrees = point.lat * (180 / Math.pow(2, 31))
          const longDegrees = point.long * (180 / Math.pow(2, 31))
          return [latDegrees, longDegrees] as [number, number]
        })

        setRoutePoints(convertedPoints)
        
        // Set start and end points
        setStartPoint(convertedPoints[0])
        setEndPoint(convertedPoints[convertedPoints.length - 1])
        
        // Calculate center point
        const avgLat = convertedPoints.reduce((sum, point) => sum + point[0], 0) / convertedPoints.length
        const avgLong = convertedPoints.reduce((sum, point) => sum + point[1], 0) / convertedPoints.length
        setMapCenter([avgLat, avgLong])
      }
    }
  }, [activity.gps_track])

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  const formatSpeed = (speed?: number) => {
    return speed ? `${(speed * 3.6).toFixed(1)} km/h` : 'N/A'
  }

  if (!isClient) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-semibold text-gray-900 mb-4">
        Interactive Route Map - {activity.file_name}
      </h3>
      
      <div className="mb-4 text-sm text-gray-600">
        <p><strong>Route Points:</strong> {routePoints.length}</p>
        <p><strong>Sport:</strong> {activity.sport || 'Unknown'}</p>
        {activity.start_time && (
          <p><strong>Start Time:</strong> {formatTime(activity.start_time)}</p>
        )}
      </div>

      <div className="h-96 w-full rounded-lg overflow-hidden border">
        <DynamicMap
          center={mapCenter}
          routePoints={routePoints}
          startPoint={startPoint}
          endPoint={endPoint}
          activity={activity}
        />
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <p><strong>Map Features:</strong></p>
        <ul className="list-disc list-inside ml-4">
          <li>Interactive zoom and pan</li>
          <li>Blue line shows your exact route</li>
          <li>Green markers show start/end points</li>
          <li>Click markers for detailed information</li>
          <li>OpenStreetMap tiles (free and open source)</li>
        </ul>
      </div>
    </div>
  )
}
