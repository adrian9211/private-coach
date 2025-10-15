'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'

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

interface MapComponentProps {
  center: [number, number]
  routePoints: [number, number][]
  startPoint: [number, number] | null
  endPoint: [number, number] | null
  activity: Activity
}

const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleTimeString()
}

const formatSpeed = (speed?: number) => {
  return speed ? `${(speed * 3.6).toFixed(1)} km/h` : 'N/A'
}

export default function MapComponent({ 
  center, 
  routePoints, 
  startPoint, 
  endPoint, 
  activity 
}: MapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    // Initialize map
    const map = L.map(mapRef.current).setView(center, 13)
    mapInstanceRef.current = map

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map)

    // Add route line
    if (routePoints.length > 1) {
      const polyline = L.polyline(routePoints, {
        color: 'blue',
        weight: 4,
        opacity: 0.8
      }).addTo(map)
      
      // Fit map to route bounds
      map.fitBounds(polyline.getBounds())
    }

    // Add start marker
    if (startPoint) {
      const startIcon = L.divIcon({
        className: 'custom-div-icon',
        html: '<div style="background-color: green; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      })
      
      const startMarker = L.marker(startPoint, { icon: startIcon }).addTo(map)
      startMarker.bindPopup(`
        <div style="font-size: 12px;">
          <strong>🏁 Start Point</strong><br/>
          <strong>Time:</strong> ${formatTime(activity.gps_track[0].timestamp)}<br/>
          <strong>Speed:</strong> ${formatSpeed(activity.gps_track[0].speed)}<br/>
          <strong>Heart Rate:</strong> ${activity.gps_track[0].heartRate || 'N/A'} bpm
        </div>
      `)
    }

    // Add end marker
    if (endPoint && endPoint !== startPoint) {
      const endIcon = L.divIcon({
        className: 'custom-div-icon',
        html: '<div style="background-color: red; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      })
      
      const endMarker = L.marker(endPoint, { icon: endIcon }).addTo(map)
      endMarker.bindPopup(`
        <div style="font-size: 12px;">
          <strong>🏁 End Point</strong><br/>
          <strong>Time:</strong> ${formatTime(activity.gps_track[activity.gps_track.length - 1].timestamp)}<br/>
          <strong>Speed:</strong> ${formatSpeed(activity.gps_track[activity.gps_track.length - 1].speed)}<br/>
          <strong>Heart Rate:</strong> ${activity.gps_track[activity.gps_track.length - 1].heartRate || 'N/A'} bpm
        </div>
      `)
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [center, routePoints, startPoint, endPoint, activity])

  return (
    <div 
      ref={mapRef} 
      style={{ height: '100%', width: '100%' }}
      className="leaflet-container"
    />
  )
}