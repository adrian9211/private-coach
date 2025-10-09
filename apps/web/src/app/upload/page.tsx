'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { UserMenu } from '@/components/auth/user-menu'
import { FileUpload } from '@/components/upload/file-upload'

export default function UploadPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-xl font-bold text-gray-900">Upload Activity</h1>
          </div>
          <UserMenu />
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <FileUpload 
            onUploadComplete={(activityId) => {
              // Optionally redirect to activities page or show success message
              console.log('Upload completed:', activityId)
            }}
          />

          {/* Upload Instructions */}
          <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">How to Upload Your Activity</h3>
            
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
                  <span className="text-blue-600 font-semibold text-sm">1</span>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Export from your device</h4>
                  <p className="text-gray-600 text-sm">Connect your Garmin, Wahoo, or other cycling computer to your computer and export the .fit file</p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
                  <span className="text-blue-600 font-semibold text-sm">2</span>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Drag and drop or browse</h4>
                  <p className="text-gray-600 text-sm">Simply drag your .fit file onto the upload area above, or click to browse and select your file</p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
                  <span className="text-blue-600 font-semibold text-sm">3</span>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Wait for processing</h4>
                  <p className="text-gray-600 text-sm">Your file will be processed automatically. You'll receive AI-powered insights and recommendations once complete</p>
                </div>
              </div>
            </div>
          </div>

          {/* Supported Formats */}
          <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Supported File Formats</h3>
            
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center p-4 border border-gray-200 rounded-lg">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-blue-600 font-semibold text-sm">FIT</span>
                </div>
                <h4 className="font-medium text-gray-900">Garmin FIT</h4>
                <p className="text-gray-600 text-sm">Most common format from Garmin devices</p>
              </div>

              <div className="text-center p-4 border border-gray-200 rounded-lg">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-green-600 font-semibold text-sm">GPX</span>
                </div>
                <h4 className="font-medium text-gray-900">GPS Exchange</h4>
                <p className="text-gray-600 text-sm">Universal GPS data format</p>
              </div>

              <div className="text-center p-4 border border-gray-200 rounded-lg">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-purple-600 font-semibold text-sm">TCX</span>
                </div>
                <h4 className="font-medium text-gray-900">Training Center</h4>
                <p className="text-gray-600 text-sm">Garmin Training Center format</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

