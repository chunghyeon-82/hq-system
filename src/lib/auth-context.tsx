'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import type { AppUser } from '@/types'

interface AuthCtx { user: AppUser | null; loading: boolean }
const Ctx = createContext<AuthCtx>({ user: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, async (u: User | null) => {
      if (u) {
        const snap = await getDoc(doc(db, 'users', u.uid))
        setUser(snap.exists() ? (snap.data() as AppUser) : null)
      } else {
        setUser(null)
      }
      setLoading(false)
    })
  }, [])

  return <Ctx.Provider value={{ user, loading }}>{children}</Ctx.Provider>
}
export const useAuth = () => useContext(Ctx)
