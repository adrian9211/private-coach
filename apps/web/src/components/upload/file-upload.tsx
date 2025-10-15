'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

interface FileUploadProps {
  onUploadComplete?: (activityId: string) => void
}

export function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  
  const { user } = useAuth()

  const validateFile = (file: File): string | null => {
    // Check file extension
    const allowedExtensions = ['.fit', '.gpx', '.tcx']
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
    
    if (!allowedExtensions.includes(fileExtension)) {
      return 'Please upload a .fit, .gpx, or .tcx file'
    }

    // Check file size (50MB limit)
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      return 'File size must be less than 50MB'
    }

    // Check if file is empty
    if (file.size === 0) {
      return 'File appears to be empty'
    }

    return null
  }

  const uploadFile = async (file: File) => {
    console.log('Starting upload for file:', file.name, 'Size:', file.size)
    
    if (!user) {
      console.error('No user found')
      setError('You must be logged in to upload files')
      return
    }

    console.log('User found:', user.id)
    console.log('Supabase client:', supabase)
    console.log('Supabase storage:', supabase.storage)

    const validationError = validateFile(file)
    if (validationError) {
      console.error('Validation error:', validationError)
      setError(validationError)
      return
    }

    console.log('File validation passed')
    setUploading(true)
    setError(null)
    setUploadProgress(0)
    setUploadStatus('Preparing upload...')

    try {
      // Generate unique filename
      const timestamp = Date.now()
      const fileExtension = file.name.substring(file.name.lastIndexOf('.'))
      const fileName = `${user.id}/${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`

      // Upload to Supabase Storage
      setUploadStatus('Uploading file...')
      console.log('Uploading to storage bucket activity-files with path:', fileName)

      // Pick a conservative content type. FIT is often validated as vendor type.
      const contentType = fileExtension === '.fit'
        ? 'application/vnd.ant.fit'
        : fileExtension === '.gpx'
          ? 'application/gpx+xml'
          : fileExtension === '.tcx'
            ? 'application/tcx+xml'
            : 'application/octet-stream'

      // Upload the actual file directly
      console.log('Uploading FIT file directly...')
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('activity-files')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
          contentType
        })
      
      console.log('Storage upload result:', { uploadData, uploadError })

      if (uploadError) {
        console.error('Storage upload failed:', uploadError)
        
        // Check if it's a bucket not found error
        if (uploadError.message.includes('Bucket not found') || uploadError.message.includes('does not exist')) {
          throw new Error("Storage bucket 'activity-files' not found. Create it in Supabase Storage with private access and allowed MIME types for FIT files.")
        }
        
        // Common RLS policy error hint
        if (uploadError.message.toLowerCase().includes('policy') || uploadError.message.toLowerCase().includes('permission')) {
          throw new Error("Upload blocked by Storage RLS policy. Ensure policies allow INSERT to 'activity-files' when path starts with your user id.")
        }
        
        throw new Error(`Upload failed: ${uploadError.message}`)
      }

      console.log('Storage upload successful:', uploadData)

      setUploadProgress(50)
      setUploadStatus('Saving activity record...')

      // Create activity record in database
      console.log('Inserting activity record to database')
      const activityRecord = {
        user_id: user.id,
        file_name: file.name,
        file_size: file.size,
        status: 'uploaded',
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          uploadDate: new Date().toISOString(),
          fileType: fileExtension,
          storagePath: uploadData.path
        }
      }
      console.log('Activity record data:', activityRecord)
      
      const { data: activityData, error: dbError } = await supabase
        .from('activities')
        .insert(activityRecord)
        .select()
        .single()

      console.log('Database insert result:', { activityData, dbError })

      if (dbError) {
        console.error('Database insert failed:', dbError)
        throw new Error(`Database error: ${dbError.message}`)
      }

      console.log('Activity record created successfully:', activityData)

      setUploadProgress(75)
      setUploadStatus('Starting file processing...')

      // Trigger file processing
      console.log('Calling process-activity function with:', {
        activityId: activityData.id,
        fileName: file.name,
        fileSize: file.size
      })
      
      const { error: processError } = await supabase.functions.invoke('process-activity', {
        body: {
          activityId: activityData.id,
          fileName: file.name,
          fileSize: file.size
        }
      })

      console.log('Process function response:', { processError })

      if (processError) {
        console.error('Processing error:', processError)
        setUploadStatus('Upload complete, processing will start shortly...')
      } else {
        setUploadStatus('Processing started successfully!')
      }

      setUploadProgress(100)
      setUploadedFile(file)

      // Call completion callback
      if (onUploadComplete) {
        onUploadComplete(activityData.id)
      }

    } catch (err) {
      console.error('Upload error:', err)
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      uploadFile(files[0])
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      uploadFile(files[0])
    }
  }

  const resetUpload = () => {
    setUploadedFile(null)
    setUploadProgress(0)
    setUploadStatus('')
    setError(null)
  }

  if (uploadedFile) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-green-900">Upload Complete!</h3>
        </div>
        
        <div className="mb-4">
          <p className="text-green-700 mb-2">
            <strong>File:</strong> {uploadedFile.name}
          </p>
          <p className="text-green-700 mb-2">
            <strong>Size:</strong> {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
          </p>
          <p className="text-green-700">
            <strong>Status:</strong> {uploadStatus || 'Processing...'}
          </p>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={resetUpload}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
          >
            Upload Another File
          </button>
          <button
            onClick={() => window.location.href = '/activities'}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            View Activities
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-semibold text-gray-900 mb-4">Upload Activity File</h3>
      
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragOver
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="mb-4">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-lg text-gray-600 mb-2">
            {isDragOver ? 'Drop your file here' : 'Drag and drop your .fit file here'}
          </p>
          <p className="text-sm text-gray-500 mb-4">
            or click to browse files
          </p>
        </div>

        <input
          type="file"
          accept=".fit,.gpx,.tcx"
          onChange={handleFileSelect}
          className="hidden"
          id="file-upload"
          disabled={uploading}
        />
        
        <label
          htmlFor="file-upload"
          className={`inline-block px-6 py-3 rounded-md font-medium cursor-pointer transition-colors ${
            uploading
              ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {uploading ? 'Uploading...' : 'Choose File'}
        </label>

        <div className="mt-4 text-xs text-gray-500">
          <p>Supported formats: .fit, .gpx, .tcx</p>
          <p>Maximum file size: 50MB</p>
        </div>
      </div>

      {uploading && (
        <div className="mt-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>{uploadStatus}</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
    </div>
  )
}

