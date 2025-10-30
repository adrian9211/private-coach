'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { InteractiveMap } from './interactive-map'
import { ElevationProfile } from './elevation-profile'

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

export function GPSViewer({ activityId }: { activityId: string }) {
  const [activity, setActivity] = useState<Activity | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPoint, setSelectedPoint] = useState<GPSPoint | null>(null)
  const [ftp, setFtp] = useState<number | null>(null)

  useEffect(() => {
    fetchActivity()
  }, [activityId])

  useEffect(() => {
    const fetchFtp = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('preferences')
          .maybeSingle()
        if (error) throw error
        const prefs = data?.preferences || {}
        if (prefs.ftp && typeof prefs.ftp === 'number') {
          setFtp(prefs.ftp)
        }
      } catch (e) {
        // ignore ftp load errors silently
      }
    }
    fetchFtp()
  }, [])

  const fetchActivity = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('activities')
        .select('id, file_name, gps_track, sport, start_time')
        .eq('id', activityId)
        .single()

      if (error) throw error
      setActivity(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch activity')
    } finally {
      setLoading(false)
    }
  }

  const convertCoordinates = (lat: number, long: number) => {
    // Convert FIT SDK coordinates to decimal degrees
    const latDegrees = lat * (180 / Math.pow(2, 31))
    const longDegrees = long * (180 / Math.pow(2, 31))
    return { lat: latDegrees, long: longDegrees }
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  if (loading) return <div className="p-4">Loading GPS data...</div>
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>
  if (!activity || !activity.gps_track) return <div className="p-4">No GPS data available</div>

  const gpsPoints = activity.gps_track as GPSPoint[]
  const validPoints = gpsPoints.filter(point => point.lat && point.long)

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-semibold text-gray-900 mb-4">
        GPS Track - {activity.file_name}
      </h3>
      
      {/* Interactive Map */}
      <div className="mb-6">
        <InteractiveMap activity={activity} />
      </div>

      {/* Elevation Profile */}
      <div className="mb-6">
        <ElevationProfile activity={activity} ftp={ftp ?? undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GPS Points List */}
        <div>
          <h4 className="text-lg font-medium text-gray-800 mb-3">
            GPS Points ({validPoints.length})
          </h4>
          <div className="max-h-96 overflow-y-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">Time</th>
                  <th className="px-3 py-2 text-left">Lat</th>
                  <th className="px-3 py-2 text-left">Long</th>
                  <th className="px-3 py-2 text-left">Speed</th>
                  <th className="px-3 py-2 text-left">HR</th>
                </tr>
              </thead>
              <tbody>
                {validPoints.slice(0, 100).map((point, index) => {
                  const coords = convertCoordinates(point.lat, point.long)
                  return (
                    <tr 
                      key={index}
                      className="hover:bg-gray-50 cursor-pointer border-b"
                      onClick={() => setSelectedPoint(point)}
                    >
                      <td className="px-3 py-2">{formatTime(point.timestamp)}</td>
                      <td className="px-3 py-2">{coords.lat.toFixed(6)}</td>
                      <td className="px-3 py-2">{coords.long.toFixed(6)}</td>
                      <td className="px-3 py-2">{point.speed ? (point.speed * 3.6).toFixed(1) : '-'} km/h</td>
                      <td className="px-3 py-2">{point.heartRate || '-'} bpm</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {validPoints.length > 100 && (
              <div className="p-3 text-center text-gray-500 text-sm">
                Showing first 100 of {validPoints.length} points
              </div>
            )}
          </div>
        </div>

        {/* Selected Point Details */}
        <div>
          <h4 className="text-lg font-medium text-gray-800 mb-3">
            Point Details
          </h4>
          {selectedPoint ? (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="space-y-2">
                <div><strong>Time:</strong> {formatTime(selectedPoint.timestamp)}</div>
                <div><strong>Coordinates:</strong> {convertCoordinates(selectedPoint.lat, selectedPoint.long).lat.toFixed(6)}, {convertCoordinates(selectedPoint.lat, selectedPoint.long).long.toFixed(6)}</div>
                {selectedPoint.distance && <div><strong>Distance:</strong> {(selectedPoint.distance / 1000).toFixed(2)} km</div>}
                {selectedPoint.speed && <div><strong>Speed:</strong> {(selectedPoint.speed * 3.6).toFixed(1)} km/h</div>}
                {selectedPoint.heartRate && <div><strong>Heart Rate:</strong> {selectedPoint.heartRate} bpm</div>}
                {selectedPoint.power && <div><strong>Power:</strong> {selectedPoint.power} W</div>}
                {selectedPoint.cadence && <div><strong>Cadence:</strong> {selectedPoint.cadence} rpm</div>}
                {selectedPoint.altitude && <div><strong>Altitude:</strong> {selectedPoint.altitude} m</div>}
                {selectedPoint.temperature && <div><strong>Temperature:</strong> {selectedPoint.temperature}°C</div>}
                {selectedPoint.grade && <div><strong>Grade:</strong> {selectedPoint.grade}%</div>}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-4 text-gray-500">
              Click on a GPS point to see details
            </div>
          )}
        </div>
      </div>

      {/* Export and Mapping Options */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          onClick={() => {
            const csv = [
              'timestamp,lat,long,distance,speed,heartRate,power,cadence,altitude,temperature,grade',
              ...validPoints.map(point => {
                const coords = convertCoordinates(point.lat, point.long)
                return [
                  point.timestamp,
                  coords.lat,
                  coords.long,
                  point.distance || '',
                  point.speed ? (point.speed * 3.6) : '',
                  point.heartRate || '',
                  point.power || '',
                  point.cadence || '',
                  point.altitude || '',
                  point.temperature || '',
                  point.grade || ''
                ].join(',')
              })
            ].join('\n')
            
            const blob = new Blob([csv], { type: 'text/csv' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `${activity.file_name.replace('.fit', '')}_gps.csv`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
        >
          📊 Export CSV
        </button>
        
        <button
          onClick={() => {
            // Create a route URL with multiple waypoints for Google Maps
            const waypoints = validPoints
              .filter((_, index) => index % Math.max(1, Math.floor(validPoints.length / 10)) === 0) // Sample every nth point
              .slice(0, 10) // Limit to 10 waypoints (Google Maps limit)
              .map(point => {
                const coords = convertCoordinates(point.lat, point.long)
                return `${coords.lat},${coords.long}`
              })
            
            if (waypoints.length >= 2) {
              const startPoint = waypoints[0]
              const endPoint = waypoints[waypoints.length - 1]
              const middlePoints = waypoints.slice(1, -1)
              
              let googleMapsUrl = `https://www.google.com/maps/dir/${startPoint}`
              if (middlePoints.length > 0) {
                googleMapsUrl += `/${middlePoints.join('/')}`
              }
              googleMapsUrl += `/${endPoint}`
              
              window.open(googleMapsUrl, '_blank')
            }
          }}
          className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm"
        >
          🗺️ Google Route
        </button>

        <button
          onClick={() => {
            // Create a route URL for OpenStreetMap with multiple waypoints
            const waypoints = validPoints
              .filter((_, index) => index % Math.max(1, Math.floor(validPoints.length / 20)) === 0) // Sample points
              .slice(0, 20) // Limit waypoints
              .map(point => {
                const coords = convertCoordinates(point.lat, point.long)
                return `${coords.lat},${coords.long}`
              })
            
            if (waypoints.length >= 2) {
              // Use GraphHopper routing service
              const startPoint = waypoints[0]
              const endPoint = waypoints[waypoints.length - 1]
              const graphHopperUrl = `https://graphhopper.com/maps/?point=${startPoint}&point=${endPoint}&vehicle=bike&weighting=fastest&elevation=true&use_miles=false&layer=OpenStreetMap`
              window.open(graphHopperUrl, '_blank')
            }
          }}
          className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 text-sm"
        >
          🌍 Route Map
        </button>

        <button
          onClick={() => {
            const firstPoint = validPoints[0]
            if (firstPoint) {
              const coords = convertCoordinates(firstPoint.lat, firstPoint.long)
              const bingMapsUrl = `https://www.bing.com/maps?cp=${coords.lat}~${coords.long}&lvl=15`
              window.open(bingMapsUrl, '_blank')
            }
          }}
          className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 text-sm"
        >
          🗺️ Bing Maps
        </button>
      </div>

      {/* GPX Export - Full Route */}
      <div className="mt-4">
        <button
          onClick={() => {
            const firstPoint = validPoints[0]
            const lastPoint = validPoints[validPoints.length - 1]
            
            if (firstPoint && lastPoint) {
              const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Private Coach App">
  <trk>
    <name>${activity.file_name.replace('.fit', '')}</name>
    <desc>Complete GPS track with sensor data</desc>
    <trkseg>
      ${validPoints.map(point => {
        const coords = convertCoordinates(point.lat, point.long)
        return `      <trkpt lat="${coords.lat}" lon="${coords.long}">
        <time>${point.timestamp}</time>
        ${point.altitude ? `<ele>${point.altitude}</ele>` : ''}
        <extensions>
          ${point.heartRate ? `<hr>${point.heartRate}</hr>` : ''}
          ${point.power ? `<power>${point.power}</power>` : ''}
          ${point.cadence ? `<cadence>${point.cadence}</cadence>` : ''}
          ${point.speed ? `<speed>${point.speed}</speed>` : ''}
        </extensions>
      </trkpt>`
      }).join('\n')}
    </trkseg>
  </trk>
</gpx>`
              
              const blob = new Blob([gpx], { type: 'application/gpx+xml' })
              const url = URL.createObjectURL(blob)
              const link = document.createElement('a')
              link.href = url
              link.download = `${activity.file_name.replace('.fit', '')}.gpx`
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)
              URL.revokeObjectURL(url)
            }
          }}
          className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 text-sm"
        >
          📍 Export Full GPX
        </button>
        
        <div className="mt-2 text-sm text-gray-600">
          <p><strong>GPX Export includes:</strong></p>
          <ul className="list-disc list-inside ml-4">
            <li>Complete GPS track with all waypoints</li>
            <li>Heart rate, power, cadence, speed data</li>
            <li>Altitude and timestamps</li>
            <li>Compatible with Strava, Garmin Connect, TrainingPeaks</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
