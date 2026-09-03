'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react'

import { api } from './api'
import type { User } from './types'

type AuthContextType = {
  user: User | null
  loading: boolean
  login: (identifier: string, password: string) => Promise<User>
  register: (
    username: string,
    email: string,
    password: string
  ) => Promise<User>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = async () => {
    try {
      setUser((await api.me()) as User)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshUser()
  }, [])

  const login = async (
    identifier: string,
    password: string
  ) => {
    const result = await api.login({
      identifier,
      password,
    })

    await refreshUser()

    return result as User
  }

  const register = async (
    username: string,
    email: string,
    password: string
  ) => {
    const result = await api.register({
      username,
      email,
      password,
    })

    // Register now creates the session on the backend,
    // so immediately store the authenticated user.
    const registeredUser = result as User
    setUser(registeredUser)

    return registeredUser
  }

  const logout = async () => {
    await api.logout()
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)

  if (!ctx) {
    throw new Error(
      'useAuth must be used inside AuthProvider'
    )
  }

  return ctx
}