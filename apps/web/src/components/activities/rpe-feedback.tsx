'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface RPEFeedbackProps {
  activityId: string
  initialRPE?: number | null
  onRPEChange?: (rpe: number) => void
}

const RPE_DESCRIPTIONS = {
  1: 'Resting - No effort',
  2: 'Very Easy - Light effort, can maintain indefinitely',
  3: 'Easy - Comfortable pace, easy conversation',
  4: 'Moderate - Starting to feel effort, still comfortable',
  5: 'Moderately Hard - Noticeable effort, breathing deeper',
  6: 'Hard - Definite effort, breathing heavily',
  7: 'Very Hard - Very difficult, can maintain briefly',
  8: 'Extremely Hard - Maximum effort, very uncomfortable',
  9: 'Maximum - Near exhaustion, unsustainable',
  10: 'Absolute Maximum - Complete exhaustion, cannot continue'
}

export function RPEFeedback({ activityId, initialRPE, onRPEChange }: RPEFeedbackProps) {
  const [rpe, setRpe] = useState<number | null>(initialRPE || null)
  const [selectedRpe, setSelectedRpe] = useState<number | null>(initialRPE || null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (initialRPE !== undefined) {
      setRpe(initialRPE)
      setSelectedRpe(initialRPE)
    }
  }, [initialRPE])

  const handleRPEChange = async (value: number) => {
    setSelectedRpe(value)
    setRpe(value)
    setError(null)
    setSuccess(false)

    if (onRPEChange) {
      onRPEChange(value)
    }

    // Auto-save after selection
    setSaving(true)
    try {
      const { error: updateError } = await supabase
        .from('activities')
        .update({ rpe: value })
        .eq('id', activityId)

      if (updateError) throw updateError

      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    } catch (err: any) {
      console.error('Error saving RPE:', err)
      setError('Failed to save RPE. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          Rate of Perceived Exertion (RPE)
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          How hard did this workout feel? RPE helps us understand your perceived effort and improves AI coaching recommendations.
        </p>
      </div>

      {/* RPE Scale */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Select your RPE:</span>
          {selectedRpe && (
            <span className="text-sm font-semibold text-blue-600">
              RPE {selectedRpe} - {RPE_DESCRIPTIONS[selectedRpe as keyof typeof RPE_DESCRIPTIONS]}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => {
            const isSelected = selectedRpe === value
            const intensity = value <= 3 ? 'bg-green-100 border-green-400' : 
                              value <= 5 ? 'bg-yellow-100 border-yellow-400' :
                              value <= 7 ? 'bg-orange-100 border-orange-400' :
                              'bg-red-100 border-red-400'
            
            return (
              <button
                key={value}
                onClick={() => handleRPEChange(value)}
                disabled={saving}
                className={`
                  w-10 h-10 sm:w-12 sm:h-12 rounded-lg border-2 font-semibold text-sm sm:text-base
                  transition-all duration-200
                  ${isSelected 
                    ? `${intensity} scale-110 shadow-md` 
                    : 'bg-gray-50 border-gray-300 hover:bg-gray-100 hover:scale-105'
                  }
                  ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
                title={RPE_DESCRIPTIONS[value as keyof typeof RPE_DESCRIPTIONS]}
              >
                {value}
              </button>
            )
          })}
        </div>
      </div>

      {/* RPE Description Guide */}
      <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4">
        <h4 className="text-xs sm:text-sm font-semibold text-gray-900 mb-2">RPE Scale Guide:</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="flex items-start">
            <span className="text-green-600 font-semibold mr-2">1-3:</span>
            <span className="text-gray-600">Easy effort, recovery pace</span>
          </div>
          <div className="flex items-start">
            <span className="text-yellow-600 font-semibold mr-2">4-5:</span>
            <span className="text-gray-600">Moderate effort, endurance pace</span>
          </div>
          <div className="flex items-start">
            <span className="text-orange-600 font-semibold mr-2">6-7:</span>
            <span className="text-gray-600">Hard effort, threshold/VO2max</span>
          </div>
          <div className="flex items-start">
            <span className="text-red-600 font-semibold mr-2">8-10:</span>
            <span className="text-gray-600">Very hard to maximum effort</span>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-sm">
          RPE saved successfully!
        </div>
      )}
      {saving && (
        <div className="text-sm text-gray-600 flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
          Saving...
        </div>
      )}

      {/* Why RPE Matters */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <details className="text-xs sm:text-sm text-gray-600">
          <summary className="cursor-pointer font-medium text-gray-900 hover:text-blue-600">
            Why is RPE important?
          </summary>
          <div className="mt-2 pl-4 space-y-1">
            <p>• <strong>Subjective Context:</strong> Captures how hard the workout felt, which metrics alone can't measure</p>
            <p>• <strong>Fatigue Detection:</strong> High RPE with low power may indicate overtraining or illness</p>
            <p>• <strong>Training Load:</strong> Helps calculate accurate training stress (similar to Intervals.icu, TrainingPeaks)</p>
            <p>• <strong>Recovery Insights:</strong> AI can recommend rest when RPE is consistently high</p>
            <p>• <strong>Personalization:</strong> Improves AI coaching by understanding your perceived effort patterns</p>
          </div>
        </details>
      </div>
    </div>
  )
}

