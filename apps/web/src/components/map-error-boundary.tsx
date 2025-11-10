'use client'

import React from 'react'

interface MapErrorBoundaryState {
  hasError: boolean
  error?: Error
}

interface MapErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export class MapErrorBoundary extends React.Component<MapErrorBoundaryProps, MapErrorBoundaryState> {
  constructor(props: MapErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): MapErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Map Error Boundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="h-96 w-full rounded-lg border border-red-200 bg-red-50 flex items-center justify-center">
          <div className="text-center text-red-600">
            <div className="text-lg font-semibold mb-2">Map Loading Error</div>
            <div className="text-sm">
              The interactive map could not be loaded. This might be due to:
            </div>
            <ul className="text-xs mt-2 text-red-500 text-left list-disc list-inside">
              <li>Network connectivity issues</li>
              <li>Invalid GPS data format</li>
              <li>Browser compatibility issues</li>
            </ul>
            <button 
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}








