// src/contexts/AuthContext.tsx
// Authentication context. Supabase Auth is wired behind environment variables;
// tests use a fake provider that never hits the network.

import * as React from 'react'

export type AuthProvider = 'google' | 'apple' | null

export interface AuthContextType {
  user: { id: string; email: string; name: string | null; provider: AuthProvider } | null
  signInWith: (provider: AuthProvider) => Promise<void>
  signOut: () => Promise<void>
  loading: boolean
  error: string | null
  clearError: () => void
}

const AuthContext = React.createContext<AuthContextType | null>(null)

export function AuthProviderComponent({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  const [user, setUser] = React.useState<AuthContextType['user']>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const clearError = (): void => setError(null)

  const signInWith = async (provider: AuthProvider): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      // In production this would call Supabase Auth with PKCE and state.
      // Credentials come from environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).
      // For local development/tests a fake provider is used; no network calls are made.
      const fakeAuth =
        import.meta.env.DEV && import.meta.env.VITE_TEST_FAKE_AUTH === 'true'
      if (fakeAuth) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        setUser({
          id: `fake-user-${provider}`,
          email: `user-${provider}@example.test`,
          name: provider === 'apple' ? 'Apple User' : 'Google User',
          provider,
        })
        return
      }
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      if (!supabaseUrl || !supabaseKey) {
        throw new Error(
          'Supabase credentials not configured. Create .env.local from .env.example and set VITE_TEST_FAKE_AUTH=true for local development.'
        )
      }
      // Real Supabase flow would go here using @supabase/supabase-js
      throw new Error('Supabase auth not yet implemented')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const signOut = async (): Promise<void> => {
    setLoading(true)
    try {
      setUser(null)
      setError(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthContext.Provider value={{ user, signInWith, signOut, loading, error, clearError }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = React.useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
