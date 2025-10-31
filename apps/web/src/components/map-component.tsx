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
  const layersRef = useRef<L.Layer[]>([])
  const isInitializedRef = useRef(false)

  useEffect(() => {
    if (!mapRef.current) return

    // Add a small delay to ensure DOM is ready
    const initMap = () => {
      try {
        if (!mapRef.current) return

        // Clean up existing map if it exists
        if (mapInstanceRef.current) {
          try {
            // Remove all layers first
            mapInstanceRef.current.eachLayer((layer) => {
              try {
                mapInstanceRef.current?.removeLayer(layer)
              } catch (e) {
                // Ignore errors during cleanup
              }
            })
            mapInstanceRef.current.remove()
          } catch (e) {
            console.warn('Error cleaning up existing map:', e)
          }
          mapInstanceRef.current = null
          layersRef.current = []
        }

        // Verify container still exists
        if (!mapRef.current) return

        // Initialize map with error handling
        const map = L.map(mapRef.current, {
          preferCanvas: true,
          zoomControl: true,
          attributionControl: true,
          fadeAnimation: false, // Prevent animation issues during updates
          zoomAnimation: false // Prevent animation issues during updates
        }).setView(center, 13)
        
        mapInstanceRef.current = map
        isInitializedRef.current = true

        // Add tile layer with error handling
        const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
          errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
        })
        
        tileLayer.addTo(map)
        layersRef.current.push(tileLayer)

        // Add route line
        if (routePoints.length > 1 && mapInstanceRef.current && mapRef.current) {
          try {
            const polyline = L.polyline(routePoints, {
              color: 'blue',
              weight: 4,
              opacity: 0.8
            }).addTo(map)
            layersRef.current.push(polyline)
            
            // Fit map to route bounds with error handling
            setTimeout(() => {
              if (mapInstanceRef.current && mapRef.current) {
                try {
                  const bounds = polyline.getBounds()
                  if (bounds.isValid()) {
                    mapInstanceRef.current.fitBounds(bounds, { padding: [20, 20] })
                  }
                } catch (e) {
                  console.warn('Error fitting bounds:', e)
                }
              }
            }, 50)
          } catch (error) {
            console.warn('Error adding route line:', error)
          }
        }

        // Add start marker
        if (startPoint && activity.gps_track && activity.gps_track.length > 0 && mapInstanceRef.current && mapRef.current) {
          try {
            const startIcon = L.divIcon({
              className: 'custom-div-icon',
              html: '<div style="background-color: green; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;"></div>',
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            })
            
            const startMarker = L.marker(startPoint, { icon: startIcon }).addTo(map)
            layersRef.current.push(startMarker)
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
        if (endPoint && endPoint !== startPoint && activity.gps_track && activity.gps_track.length > 0 && mapInstanceRef.current && mapRef.current) {
          try {
            const endIcon = L.divIcon({
              className: 'custom-div-icon',
              html: '<div style="background-color: red; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;"></div>',
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            })
            
            const endMarker = L.marker(endPoint, { icon: endIcon }).addTo(map)
            layersRef.current.push(endMarker)
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
          if (mapInstanceRef.current && mapRef.current) {
            try {
              mapInstanceRef.current.invalidateSize()
            } catch (e) {
              console.warn('Error invalidating size:', e)
            }
          }
        }, 100)

      } catch (error) {
        console.error('Error initializing map:', error)
        // Clean up on error
        if (mapInstanceRef.current) {
          try {
            mapInstanceRef.current.remove()
          } catch (e) {
            // Ignore cleanup errors
          }
          mapInstanceRef.current = null
          layersRef.current = []
          isInitializedRef.current = false
        }
      }
    }

    // Use requestAnimationFrame to ensure DOM is ready
    const timeoutId = setTimeout(initMap, 100)

    return () => {
      clearTimeout(timeoutId)
      if (mapInstanceRef.current) {
        try {
          // Remove all layers first to prevent Leaflet from accessing removed DOM elements
          layersRef.current.forEach(layer => {
            try {
              if (mapInstanceRef.current) {
                mapInstanceRef.current.removeLayer(layer)
              }
            } catch (e) {
              // Ignore individual layer removal errors
            }
          })
          layersRef.current = []
          
          // Then remove the map
          if (mapInstanceRef.current) {
            mapInstanceRef.current.remove()
          }
        } catch (error) {
          console.warn('Error removing map:', error)
        }
        mapInstanceRef.current = null
        isInitializedRef.current = false
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