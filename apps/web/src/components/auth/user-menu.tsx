'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'

export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const { user, signOut } = useAuth()
  const router = useRouter()

  const handleSignOut = async () => {
    setIsLoggingOut(true)
    try {
      const { error } = await signOut()
      if (error) {
        console.error('Sign out error:', error)
        // Don't reset loading state on error - let the redirect happen
        // The component will unmount anyway
      }
      // The redirect is handled in the signOut function itself
    } catch (error) {
      console.error('Unexpected sign out error:', error)
      // Even on unexpected errors, don't reset loading state
      // The redirect should still happen
    }
    // Note: We don't setIsLoggingOut(false) because the component will unmount
    // when the redirect happens, so the loading state doesn't matter
  }

  if (!user) return null

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 text-gray-700 hover:text-gray-900"
      >
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">
          {user.email?.charAt(0).toUpperCase()}
        </div>
        <span className="hidden md:block">{user.email}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
          <div className="px-4 py-2 text-sm text-gray-700 border-b">
            <p className="font-medium">{user.email}</p>
            {user.user_metadata?.name && (
              <p className="text-gray-500">{user.user_metadata.name}</p>
            )}
          </div>
          <button
            onClick={() => {
              router.push('/settings')
              setIsOpen(false)
            }}
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            Settings
          </button>
          <button
            onClick={handleSignOut}
            disabled={isLoggingOut}
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoggingOut ? 'Signing Out...' : 'Sign Out'}
          </button>
        </div>
      )}
    </div>
  )
}
