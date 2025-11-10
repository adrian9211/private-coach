'use client'

import { useState, useEffect } from 'react'

interface WeekPlanConfigModalProps {
  isOpen: boolean
  onClose: () => void
  onGenerate: (config: {
    startDate: string
    availableHours: number
    availableDays: number[]
  }) => void
  defaultHours?: number | null
  loading?: boolean
}

export function WeekPlanConfigModal({
  isOpen,
  onClose,
  onGenerate,
  defaultHours,
  loading = false,
}: WeekPlanConfigModalProps) {
  const [startDate, setStartDate] = useState<string>('')
  const [availableHours, setAvailableHours] = useState<string>('')
  const [availableDays, setAvailableDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]) // All days by default

  useEffect(() => {
    if (isOpen) {
      // Set default start date to tomorrow
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      setStartDate(tomorrow.toISOString().split('T')[0])

      // Set default hours from user profile or 4
      if (defaultHours) {
        setAvailableHours(defaultHours.toString())
      } else {
        setAvailableHours('4')
      }

      // Default to all days
      setAvailableDays([1, 2, 3, 4, 5, 6, 0])
    }
  }, [isOpen, defaultHours])

  const dayLabels = [
    { value: 0, label: 'Sunday', short: 'Sun' },
    { value: 1, label: 'Monday', short: 'Mon' },
    { value: 2, label: 'Tuesday', short: 'Tue' },
    { value: 3, label: 'Wednesday', short: 'Wed' },
    { value: 4, label: 'Thursday', short: 'Thu' },
    { value: 5, label: 'Friday', short: 'Fri' },
    { value: 6, label: 'Saturday', short: 'Sat' },
  ]

  const toggleDay = (day: number) => {
    setAvailableDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  const handleGenerate = () => {
    const hours = parseFloat(availableHours)
    if (!startDate || !hours || hours <= 0 || availableDays.length === 0) {
      return
    }
    onGenerate({
      startDate,
      availableHours: hours,
      availableDays: availableDays.sort(),
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Configure Week Plan</h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              {/* Start Date */}
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-2">
                  Week Start Date
                </label>
                <input
                  type="date"
                  id="startDate"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Available Hours */}
              <div>
                <label htmlFor="availableHours" className="block text-sm font-medium text-gray-700 mb-2">
                  Available Training Hours Per Week
                </label>
                <input
                  type="number"
                  id="availableHours"
                  min="1"
                  max="20"
                  step="0.5"
                  value={availableHours}
                  onChange={(e) => setAvailableHours(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 4"
                />
                <p className="mt-1 text-sm text-gray-500">
                  This can vary from week to week. Adjust as needed.
                </p>
              </div>

              {/* Available Days */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Available Training Days
                </label>
                <div className="grid grid-cols-7 gap-2">
                  {dayLabels.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={`
                        py-2 px-1 rounded-md text-sm font-medium transition-colors
                        ${
                          availableDays.includes(day.value)
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }
                      `}
                      title={day.label}
                    >
                      {day.short}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Selected: {availableDays.length} day{availableDays.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading || !startDate || !availableHours || parseFloat(availableHours) <= 0 || availableDays.length === 0}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </span>
              ) : (
                'Generate Plan'
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

