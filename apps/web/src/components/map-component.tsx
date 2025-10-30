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

    // Add a small delay to ensure DOM is ready
    const initMap = () => {
      try {
        if (!mapRef.current || mapInstanceRef.current) return

        // Initialize map with error handling
        const map = L.map(mapRef.current, {
          preferCanvas: true,
          zoomControl: true,
          attributionControl: true
        }).setView(center, 13)
        
        mapInstanceRef.current = map

        // Add tile layer with error handling
        const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
          errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
        })
        
        tileLayer.addTo(map)

        // Add route line
        if (routePoints.length > 1) {
          try {
            const polyline = L.polyline(routePoints, {
              color: 'blue',
              weight: 4,
              opacity: 0.8
            }).addTo(map)
            
            // Fit map to route bounds with error handling
            const bounds = polyline.getBounds()
            if (bounds.isValid()) {
              map.fitBounds(bounds, { padding: [20, 20] })
            }
          } catch (error) {
            console.warn('Error adding route line:', error)
          }
        }

        // Add start marker
        if (startPoint && activity.gps_track && activity.gps_track.length > 0) {
          try {
            const startIcon = L.divIcon({
              className: 'custom-div-icon',
              html: '<div style="background-color: green; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;"></div>',
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            })
            
            const startMarker = L.marker(startPoint, { icon: startIcon }).addTo(map)
            const firstPoint = activity.gps_track[0]
            startMarker.bindPopup(`
              <div style="font-size: 12px;">
                <strong>🏁 Start Point</strong><br/>
                <strong>Time:</strong> ${formatTime(firstPoint.timestamp)}<br/>
                <strong>Speed:</strong> ${formatSpeed(firstPoint.speed)}<br/>
                <strong>Heart Rate:</strong> ${firstPoint.heartRate || 'N/A'} bpm
              </div>
            `)
          } catch (error) {
            console.warn('Error adding start marker:', error)
          }
        }

        // Add end marker
        if (endPoint && endPoint !== startPoint && activity.gps_track && activity.gps_track.length > 0) {
          try {
            const endIcon = L.divIcon({
              className: 'custom-div-icon',
              html: '<div style="background-color: red; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;"></div>',
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            })
            
            const endMarker = L.marker(endPoint, { icon: endIcon }).addTo(map)
            const lastPoint = activity.gps_track[activity.gps_track.length - 1]
            endMarker.bindPopup(`
              <div style="font-size: 12px;">
                <strong>🏁 End Point</strong><br/>
                <strong>Time:</strong> ${formatTime(lastPoint.timestamp)}<br/>
                <strong>Speed:</strong> ${formatSpeed(lastPoint.speed)}<br/>
                <strong>Heart Rate:</strong> ${lastPoint.heartRate || 'N/A'} bpm
              </div>
            `)
          } catch (error) {
            console.warn('Error adding end marker:', error)
          }
        }

        // Force map to invalidate size after initialization
        setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize()
          }
        }, 100)

      } catch (error) {
        console.error('Error initializing map:', error)
        // Clean up on error
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove()
          mapInstanceRef.current = null
        }
      }
    }

    // Use requestAnimationFrame to ensure DOM is ready
    const timeoutId = setTimeout(initMap, 100)

    return () => {
      clearTimeout(timeoutId)
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove()
        } catch (error) {
          console.warn('Error removing map:', error)
        }
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