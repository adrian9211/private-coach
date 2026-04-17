'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string, name?: string) => Promise<{ error: AuthError | null }>
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<{ error: AuthError | null }>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ session: serverSession, children }: { session: Session | null, children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(serverSession?.user ?? null)
  const [session, setSession] = useState<Session | null>(serverSession)
  const [loading, setLoading] = useState(false) // No longer loading by default
  const router = useRouter() // Get the router instance

  useEffect(() => {
    // ── Safari fix: force server-side session refresh on mount ───────────────
    // getSession() reads localStorage blindly without validating the token.
    // In regular Safari, the localStorage token can be stale/expired while
    // the server cookie belongs to a newer session — causing all Supabase
    // queries to silently fail (RLS rejects the stale JWT).
    // refreshSession() hits the Supabase server to get a fresh token, which
    // aligns the client and server and fixes the regular vs. private mode gap.
    supabase.auth.refreshSession()
      .then(({ data, error }) => {
        if (error) {
          // Refresh failed (token truly expired / invalid): wipe stale storage
          // so the next getSession() starts clean, then redirect to sign-in.
          console.warn('Session refresh failed — clearing stale storage:', error.message)
          if (typeof window !== 'undefined') {
            Object.keys(localStorage).forEach((k) => {
              if (k.startsWith('sb-')) localStorage.removeItem(k)
            })
            Object.keys(sessionStorage).forEach((k) => {
              if (k.startsWith('sb-')) sessionStorage.removeItem(k)
            })
          }
          // Don't redirect here — let the auth state change handler do it
          return
        }
        if (data.session) {
          setSession(data.session)
          setUser(data.session.user)
        }
      })
      .catch((e) => console.warn('Session refresh error:', e))
    // ─────────────────────────────────────────────────────────────────────────

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session?.user?.id)

      // INITIAL_SESSION fires immediately if a persisted session exists —
      // handle it the same way as SIGNED_IN so user is set without delay.
      if (event === 'INITIAL_SESSION') {
        setSession(session)
        setUser(session?.user ?? null)
        return
      }

      setSession(session)
      setUser(session?.user ?? null)
      
      if (event === 'SIGNED_IN' && session?.user) {
        await createUserProfile(session.user)
        // Redirect to dashboard after successful sign-in
        router.push('/dashboard')
        router.refresh()
      } else if (event === 'SIGNED_OUT') {
        // Clear loading state and redirect
        setLoading(false)
        router.push('/auth/signin')
        router.refresh()
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  // On tab focus / visibility restore: refresh the token server-side.
  // Using getSession() here would return the stale localStorage value.
  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const { data } = await supabase.auth.refreshSession()
          if (data.session) {
            setSession(data.session)
            setUser(data.session.user)
          }
        } catch (e) {
          console.warn('Failed to refresh session on visibility change', e)
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleVisibility)
    }
  }, [])

  const createUserProfile = async (user: User) => {
    try {
      const { error } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email!,
          name: user.user_metadata?.name || null,
          preferences: {
            goals: [],
            availableTime: {
              weekdays: 60, // 1 hour default
              weekends: 120, // 2 hours default
            },
            experienceLevel: 'intermediate',
            preferredWorkoutTypes: ['endurance'],
            notifications: {
              weeklySummary: true,
              workoutReminders: true,
              achievementAlerts: true,
              email: true,
              push: false,
            },
          },
        })

      if (error) {
        console.error('Error creating user profile:', error)
      }
    } catch (error) {
      console.error('Error creating user profile:', error)
    }
  }

  const signUp = async (email: string, password: string, name?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || '',
        },
      },
    })
    return { error }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signOut = async () => {
    try {
      setLoading(true) // Set loading state
      
      // Clear local state immediately for better UX
      setUser(null)
      setSession(null)
      
      // Clear the session from Supabase client locally (no network call)
      try {
        // Clear all Supabase-related storage
        if (typeof window !== 'undefined') {
          // Clear all localStorage items that start with 'sb-'
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('sb-')) {
              localStorage.removeItem(key)
            }
          })
          // Clear all sessionStorage items that start with 'sb-'
          Object.keys(sessionStorage).forEach(key => {
            if (key.startsWith('sb-')) {
              sessionStorage.removeItem(key)
            }
          })
        }
        
        // Clear the session from Supabase client (local scope)
        await supabase.auth.signOut({ scope: 'local' })
      } catch (e) {
        console.warn('Failed to clear local session:', e)
      }
      
      // Also clear the auth cookie on the server to prevent re-hydration with a valid session
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)
        await fetch('/auth/signout', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
        }).catch(() => {})
        clearTimeout(timeoutId)
      } catch (e) {
        console.warn('Server signout request failed:', e)
      }
      
      // Ensure redirect even if onAuthStateChange doesn't fire
      try {
        router.push('/auth/signin')
        router.refresh()
        // Hard navigation fallback in case router is stuck
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            if (window.location.pathname !== '/auth/signin') {
              window.location.replace('/auth/signin')
            }
          }, 300)
        }
      } catch (e) {
        if (typeof window !== 'undefined') {
          window.location.replace('/auth/signin')
        }
      }
      
      return { error: null }
    } catch (error) {
      console.error('Sign out error:', error)
      return { error: error as AuthError }
    } finally {
      setLoading(false) // Always clear loading state
    }
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error }
  }

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
