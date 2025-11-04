'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

interface ActivityFeedbackProps {
  activityId: string
  initialFeeling?: number | null
  initialNotes?: string | null
  onFeelingChange?: (feeling: number) => void
  onNotesChange?: (notes: string) => void
}

const FEELING_DESCRIPTIONS = {
  1: 'Very Poor - Extremely low energy, unwell',
  2: 'Poor - Low energy, feeling off',
  3: 'Fair - Below average energy, sluggish',
  4: 'Below Average - Somewhat low energy',
  5: 'Average - Normal energy level',
  6: 'Above Average - Good energy, feeling fresh',
  7: 'Good - Very good energy, motivated',
  8: 'Very Good - Excellent energy, strong',
  9: 'Excellent - Outstanding energy, optimal',
  10: 'Perfect - Maximum energy, peak condition'
}

export function ActivityFeedback({ 
  activityId, 
  initialFeeling, 
  initialNotes,
  onFeelingChange,
  onNotesChange 
}: ActivityFeedbackProps) {
  const [feeling, setFeeling] = useState<number | null>(initialFeeling ?? null)
  const [selectedFeeling, setSelectedFeeling] = useState<number | null>(initialFeeling ?? null)
  const [notes, setNotes] = useState<string>(initialNotes ?? '')
  const [savingFeeling, setSavingFeeling] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successFeeling, setSuccessFeeling] = useState(false)
  const [successNotes, setSuccessNotes] = useState(false)
  const notesTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (initialFeeling !== undefined) {
      setFeeling(initialFeeling)
      setSelectedFeeling(initialFeeling)
    }
  }, [initialFeeling])

  useEffect(() => {
    if (initialNotes !== undefined) {
      setNotes(initialNotes || '')
    }
  }, [initialNotes])

  const handleFeelingChange = async (value: number) => {
    setSelectedFeeling(value)
    setFeeling(value)
    setError(null)
    setSuccessFeeling(false)

    if (onFeelingChange) {
      onFeelingChange(value)
    }

    // Auto-save after selection
    setSavingFeeling(true)
    try {
      const { error: updateError } = await supabase
        .from('activities')
        .update({ feeling: value })
        .eq('id', activityId)

      if (updateError) throw updateError

      setSuccessFeeling(true)
      setTimeout(() => setSuccessFeeling(false), 2000)
    } catch (err: any) {
      console.error('Error saving feeling:', err)
      setError('Failed to save feeling. Please try again.')
    } finally {
      setSavingFeeling(false)
    }
  }

  const handleNotesChange = (newNotes: string) => {
    setNotes(newNotes)
    setError(null)
    setSuccessNotes(false)

    if (onNotesChange) {
      onNotesChange(newNotes)
    }

    // Debounce auto-save
    if (notesTimeoutRef.current) {
      clearTimeout(notesTimeoutRef.current)
    }
    
    notesTimeoutRef.current = setTimeout(async () => {
      setSavingNotes(true)
      try {
        const { error: updateError } = await supabase
          .from('activities')
          .update({ personal_notes: newNotes.trim() || null })
          .eq('id', activityId)

        if (updateError) throw updateError

        setSuccessNotes(true)
        setTimeout(() => setSuccessNotes(false), 2000)
      } catch (err: any) {
        console.error('Error saving notes:', err)
        setError('Failed to save notes. Please try again.')
      } finally {
        setSavingNotes(false)
      }
    }, 1000) // Save 1 second after user stops typing
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (notesTimeoutRef.current) {
        clearTimeout(notesTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          Activity Feedback
        </h3>
        <p className="text-sm text-gray-600">
          Share how you felt and your personal experience. This helps the AI provide better analysis and recommendations.
        </p>
      </div>

      {/* Feeling Scale */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-sm font-medium text-gray-700">How did you feel overall?</span>
            <span className="text-xs text-gray-500 ml-2">(Energy level & well-being)</span>
          </div>
          {selectedFeeling && (
            <span className="text-sm font-semibold text-blue-600">
              {selectedFeeling}/10 - {FEELING_DESCRIPTIONS[selectedFeeling as keyof typeof FEELING_DESCRIPTIONS]}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => {
            const isSelected = selectedFeeling === value
            // Feeling scale: 1-3 = poor (red), 4-5 = below avg (orange), 6-7 = good (yellow), 8-10 = excellent (green)
            const intensity = value <= 3 ? 'bg-red-100 border-red-400' : 
                              value <= 5 ? 'bg-orange-100 border-orange-400' :
                              value <= 7 ? 'bg-yellow-100 border-yellow-400' :
                              'bg-green-100 border-green-400'
            
            return (
              <button
                key={value}
                onClick={() => handleFeelingChange(value)}
                disabled={savingFeeling}
                className={`
                  w-10 h-10 sm:w-12 sm:h-12 rounded-lg border-2 font-semibold text-sm sm:text-base
                  transition-all duration-200
                  ${isSelected 
                    ? `${intensity} scale-110 shadow-md` 
                    : 'bg-gray-50 border-gray-300 hover:bg-gray-100 hover:scale-105'
                  }
                  ${savingFeeling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
                title={FEELING_DESCRIPTIONS[value as keyof typeof FEELING_DESCRIPTIONS]}
              >
                {value}
              </button>
            )
          })}
        </div>

        {/* Feeling Description Guide */}
        <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mt-4">
          <h4 className="text-xs sm:text-sm font-semibold text-gray-900 mb-2">Feeling Scale Guide:</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="flex items-start">
              <span className="text-red-600 font-semibold mr-2">1-3:</span>
              <span className="text-gray-600">Poor energy, low well-being</span>
            </div>
            <div className="flex items-start">
              <span className="text-orange-600 font-semibold mr-2">4-5:</span>
              <span className="text-gray-600">Below average energy</span>
            </div>
            <div className="flex items-start">
              <span className="text-yellow-600 font-semibold mr-2">6-7:</span>
              <span className="text-gray-600">Good energy, feeling fresh</span>
            </div>
            <div className="flex items-start">
              <span className="text-green-600 font-semibold mr-2">8-10:</span>
              <span className="text-gray-600">Excellent energy, optimal condition</span>
            </div>
          </div>
        </div>
      </div>

      {/* Personal Notes */}
      <div className="mb-4">
        <label htmlFor="personal-notes" className="block text-sm font-medium text-gray-700 mb-2">
          Personal Experience & Notes
        </label>
        <textarea
          id="personal-notes"
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Share your experience: What went well? What was challenging? Any observations about the workout, conditions, or how your body felt?"
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">
          Your notes will be considered by the AI when analyzing this activity and providing recommendations.
        </p>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-4">
          {error}
        </div>
      )}
      {successFeeling && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-sm mb-4">
          Feeling saved successfully!
        </div>
      )}
      {successNotes && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-sm mb-4">
          Notes saved successfully!
        </div>
      )}
      {(savingFeeling || savingNotes) && (
        <div className="text-sm text-gray-600 flex items-center mb-4">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
          Saving...
        </div>
      )}

      {/* Why This Matters */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <details className="text-xs sm:text-sm text-gray-600">
          <summary className="cursor-pointer font-medium text-gray-900 hover:text-blue-600">
            Why is this feedback important?
          </summary>
          <div className="mt-2 pl-4 space-y-1">
            <p>• <strong>Feeling vs RPE:</strong> Feeling captures overall energy/well-being, while RPE measures workout intensity. Both are valuable for AI analysis.</p>
            <p>• <strong>Fatigue Detection:</strong> Low feeling with high RPE may indicate overtraining, illness, or poor recovery.</p>
            <p>• <strong>Recovery Insights:</strong> AI can recommend rest when feeling is consistently low, even if performance is good.</p>
            <p>• <strong>Personal Context:</strong> Your notes provide subjective context that metrics alone cannot capture.</p>
            <p>• <strong>Training Optimization:</strong> Helps AI understand patterns in your training and adjust recommendations accordingly.</p>
          </div>
        </details>
      </div>
    </div>
  )
}

