'use client'

import { useState } from 'react'
import { WorkoutProfileChart } from './workout-profile-chart'
import { formatDuration, type WorkoutData } from '@/lib/workout-parser'

interface WorkoutDetailModalProps {
  workout: WorkoutData
  category?: string
  notes?: string
  status?: string
  scheduledTime?: string | null
  onClose: () => void
  onRemove?: () => Promise<void>
}

// Helper to get zone color based on power percentage
function getZoneColor(power: number): string {
  if (power >= 1.20) return 'bg-red-500' // Z7 Neuromuscular
  if (power >= 1.06) return 'bg-orange-500' // Z6 Anaerobic
  if (power >= 0.95) return 'bg-orange-400' // Z5 VO2Max
  if (power >= 0.90) return 'bg-yellow-400' // Z4 Threshold
  if (power >= 0.76) return 'bg-green-400' // Z3 Tempo
  if (power >= 0.56) return 'bg-blue-400' // Z2 Endurance
  return 'bg-gray-400' // Z1 Active Recovery
}

export function WorkoutDetailModal({
  workout,
  category,
  notes,
  status,
  scheduledTime,
  onClose,
  onRemove,
}: WorkoutDetailModalProps) {
  const [isRemoving, setIsRemoving] = useState(false)

  const handleRemove = async () => {
    if (!onRemove || isRemoving) return
    
    if (!confirm('Remove this scheduled workout from your calendar?')) {
      return
    }
    
    setIsRemoving(true)
    try {
      await onRemove()
    } catch (error) {
      console.error('Error in handleRemove:', error)
      setIsRemoving(false)
    }
    // Note: Don't reset isRemoving on success, modal will close
  }

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black" onClick={onClose}>
      <div className="min-h-screen" onClick={(e) => e.stopPropagation()}>
        {/* Header with breadcrumb */}
        <div className="sticky top-0 z-[10000] bg-gray-900 border-b border-gray-800 shadow-lg">
          <div className="max-w-[1800px] mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <button
                  type="button"
                  onClick={onClose}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Workouts
                </button>
                <span>/</span>
                {category && (
                  <>
                    <span className="text-white">{category}</span>
                    <span>/</span>
                  </>
                )}
                <span className="text-white">{workout.name}</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer z-[10001]"
                aria-label="Close"
              >
                <svg className="w-6 h-6 text-gray-400 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Status Bar */}
        {(status || scheduledTime || onRemove) && (
          <div className="sticky top-[73px] z-[9999] bg-purple-900/30 border-b border-purple-800/50 backdrop-blur-sm">
            <div className="max-w-[1800px] mx-auto px-6 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                    <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/>
                  </svg>
                  {scheduledTime && (
                    <span className="text-sm text-purple-300 font-medium">
                      Scheduled: {scheduledTime}
                    </span>
                  )}
                  {status && (
                    <span className={`px-3 py-1 rounded-md text-xs font-semibold uppercase tracking-wide ${
                      status === 'completed' ? 'bg-green-500/20 text-green-300 border border-green-500/50' :
                      status === 'skipped' ? 'bg-gray-500/20 text-gray-300 border border-gray-500/50' :
                      'bg-purple-500/20 text-purple-300 border border-purple-500/50'
                    }`}>
                      {status === 'scheduled' ? 'Planned' : status}
                    </span>
                  )}
                </div>
                {onRemove && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleRemove()
                    }}
                    disabled={isRemoving}
                    className="px-4 py-2 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors border border-red-500/30 cursor-pointer z-[10001] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRemoving ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Removing...
                      </span>
                    ) : (
                      'Remove from Calendar'
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-[1800px] mx-auto px-6 py-8">
          {/* Title and Badges */}
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 uppercase tracking-wide">
              {workout.name}
            </h1>
            
            <div className="flex flex-wrap gap-3">
              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-md px-4 py-2">
                <span className="text-cyan-400 text-sm font-medium">Duration {formatDuration(workout.totalDuration)}</span>
              </div>
              {workout.estimatedTSS && (
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-md px-4 py-2">
                  <span className="text-cyan-400 text-sm font-medium">TSS {workout.estimatedTSS}</span>
                </div>
              )}
              {workout.estimatedIF && (
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-md px-4 py-2">
                  <span className="text-cyan-400 text-sm font-medium">IF {workout.estimatedIF}</span>
                </div>
              )}
              {workout.description && (
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-md px-4 py-2">
                  <span className="text-cyan-400 text-sm font-medium">Has instructions</span>
                </div>
              )}
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-8 mb-8">
            {/* Left Column - Workout Structure */}
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
              {workout.segments.map((segment, idx) => {
                // Get power value for color (values should be decimals: 0.45, 0.75)
                const power = segment.power || segment.powerLow || segment.onPower || 0.5
                const colorClass = getZoneColor(power)
                
                // Format power as percentage (0.45 -> 45%, 0.75 -> 75%)
                const formatPower = (val: number) => Math.round(val * 100)
                
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-2 bg-gray-900 rounded-md overflow-hidden"
                  >
                    {/* Color indicator bar */}
                    <div className={`w-1.5 h-full min-h-[52px] ${colorClass}`} />
                    
                    <div className="flex-1 py-2.5 pr-2.5">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-white font-semibold capitalize text-xs">
                          {segment.type}
                          {segment.repeat && <span className="text-gray-400 ml-1.5 text-[10px]">{segment.repeat}x</span>}
                        </span>
                        <span className="text-gray-300 font-mono text-xs">
                          {formatDuration(segment.duration)}
                        </span>
                      </div>
                      <div className="text-gray-400 text-xs leading-tight">
                        {segment.power && (
                          <span>@ {formatPower(segment.power)}%</span>
                        )}
                        {segment.powerLow && segment.powerHigh && (
                          <span>
                            @ {formatPower(segment.powerLow)}% - {formatPower(segment.powerHigh)}%
                          </span>
                        )}
                        {segment.onPower && segment.onDuration && (
                          <span>
                            {formatDuration(segment.onDuration)} @ {formatPower(segment.onPower)}%
                            {segment.offDuration && segment.offPower && (
                              <> / {formatDuration(segment.offDuration)} @ {formatPower(segment.offPower)}%</>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Right Column - Power Profile Chart */}
            <div className="bg-gray-800/50 rounded-lg p-6 flex items-center justify-center">
              <div className="w-full">
                <WorkoutProfileChart workout={workout} height={500} compact={false} />
              </div>
            </div>
          </div>

          {/* Description/Instructions */}
          {workout.description && (
            <div className="mb-8">
              <div className="bg-gray-900 rounded-lg p-6">
                <p className="text-gray-300 text-base leading-relaxed whitespace-pre-wrap">
                  {workout.description}
                </p>
              </div>
            </div>
          )}

          {/* Rationale (if scheduled) */}
          {notes && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-3">Training Rationale</h2>
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-6">
                <p className="text-purple-200 text-base leading-relaxed">
                  {notes}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

