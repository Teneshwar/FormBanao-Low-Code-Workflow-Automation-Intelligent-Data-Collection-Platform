import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile
} from 'firebase/auth'
import { auth } from '../firebase'
import { authApi } from '../lib/apiModules'
import { applySavedUserLanguage } from '../i18n'
import type { UserOut } from '../lib/types'

type AuthRole = 'admin' | 'user'

interface AuthContextType {
  user: UserOut | null
  token: string | null
  loading: boolean
  login: (email: string, password: string, role?: AuthRole) => Promise<void>
  register: (email: string, password: string, full_name?: string, role?: AuthRole) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserOut | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  const clearSession = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('pending_role')
    setToken(null)
    setUser(null)
  }, [])

  const getPendingRole = useCallback((): AuthRole => {
    const value = localStorage.getItem('pending_role')
    return value === 'admin' ? 'admin' : 'user'
  }, [])

  const refresh = useCallback(async () => {
    try {
      const me = await authApi.me()
      setUser(me)
      try {
        await applySavedUserLanguage(me.id)
      } catch {
        // Language fallback should not break session restoration.
      }
    } catch {
      clearSession()
    }
  }, [clearSession])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        // Always clear loading when Firebase reports no user.
        // If there's a stored token, try to restore the session via the backend.
        const existingToken = localStorage.getItem('token')
        if (existingToken) {
          refresh().finally(() => setLoading(false))
        } else {
          setLoading(false)
        }
        return
      }

      void (async () => {
        try {
          // Force a fresh token to ensure updated emailVerified and custom claims are present
          const idToken = await firebaseUser.getIdToken(true)
          const pendingRole = getPendingRole()
          const data = await authApi.firebaseAuth(idToken, firebaseUser.displayName || undefined, pendingRole)
          localStorage.removeItem('pending_role')
          localStorage.setItem('token', data.access_token)
          setToken(data.access_token)
          const me = await authApi.me()
          setUser(me)
        } catch (err: any) {
          // Better error visibility for the login/token-exchange step so backend
          // errors aren't swallowed as a vague network popup in the UI.
          console.error('Firebase token exchange failed:', err)
          // If the backend returned a structured error, surface the message as an exception
          // so UI code can show a helpful toast. Keep existing behavior for unknown errors.
          const message = err?.response?.data?.detail || err?.message || 'Token exchange failed'
          clearSession()
          // rethrow so any upstream handlers can react (and the UI shows a message)
          throw new Error(message)
        } finally {
          setLoading(false)
        }
      })()
    })

    return unsubscribe
  }, [clearSession, getPendingRole, refresh])

  const sendVerificationEmail = async (firebaseUser: any) => {
    try {
      await sendEmailVerification(firebaseUser)
    } catch (sendError) {
      console.error('Failed to send verification email', sendError)
      throw new Error('Unable to send verification email. Please check your inbox or spam folder and try again.')
    }
  }

  const login = async (email: string, password: string, role: AuthRole = 'user') => {
    const credential = await signInWithEmailAndPassword(auth, email, password)
    await credential.user.reload()

    // If email isn't verified (and no phone number), send a verification email and sign the user out.
    if (!credential.user.emailVerified && !credential.user.phoneNumber) {
      try {
        await sendVerificationEmail(credential.user)
      } catch (error) {
        console.error('Verification email dispatch failed on login', error)
        await signOut(auth)
        throw new Error('Email not verified. We also failed to send a verification email. Please check your inbox or spam folder, then try again or contact support.')
      }
      await signOut(auth)
      throw new Error('Email not verified. A verification link has been sent to your email. Please verify before logging in.')
    }

    // Force a fresh token after sign-in to ensure emailVerified flag and any
    // freshly-applied custom claims are present in the exchanged token.
    const idToken = await credential.user.getIdToken(true)
    const storedRole = localStorage.getItem('pending_role')
    const requestedRole: AuthRole = storedRole === 'admin' ? 'admin' : role
    const data = await authApi.firebaseAuth(idToken, credential.user.displayName || undefined, requestedRole)
    localStorage.removeItem('pending_role')
    localStorage.setItem('token', data.access_token)
    setToken(data.access_token)
    const me = await authApi.me()
    setUser(me)
    try {
      await applySavedUserLanguage(me.id)
    } catch {
      // Language fallback should not break login flow.
    }
  }

  const register = async (email: string, password: string, full_name?: string, role: AuthRole = 'user') => {
    localStorage.setItem('pending_role', role)

    // Persist the requested role server-side so verification from another device
    // still results in the correct role at the time of token exchange.
    try {
      await authApi.setPendingRole(email, role)
    } catch (err) {
      // Non-fatal: still proceed with client-side registration but log for debugging
      console.error('Failed to persist pending role:', err)
    }

    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password)
      if (full_name) {
        try {
          await updateProfile(credential.user, { displayName: full_name })
        } catch {
          /* ignore */
        }
      }

      // Send email verification and sign out to avoid exchanging an unverified token with backend
      try {
        await sendVerificationEmail(credential.user)
      } catch (error) {
        await signOut(auth)
        throw error
      }
      await signOut(auth)
      return
    } catch (error: any) {
      if (error?.code === 'auth/email-already-in-use') {
        const cleaned = await authApi.cleanupStaleFirebaseUser(email)
        if (cleaned) {
          const credential = await createUserWithEmailAndPassword(auth, email, password)
          if (full_name) {
            try {
              await updateProfile(credential.user, { displayName: full_name })
            } catch {
              /* ignore */
            }
          }
          try {
            await sendVerificationEmail(credential.user)
          } catch (error) {
            await signOut(auth)
            throw error
          }
          await signOut(auth)
          return
        }
      }
      throw error
    }
  }

  const sendPasswordReset = async (email: string) => {
    return sendPasswordResetEmail(auth, email)
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } catch {
      // ignore backend errors and always clear local session
    }

    try {
      await signOut(auth)
    } catch {
      // ignore Firebase sign-out errors
    }

    clearSession()
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refresh, sendPasswordReset }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
