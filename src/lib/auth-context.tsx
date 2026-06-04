'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from './firebase'
import type { AppUser } from '@/types'

interface AuthCtx { user: AppUser | null; loading: boolean }
const Ctx = createContext<AuthCtx>({ user: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubUser: (() => void) | null = null

    const unsubAuth = onAuthStateChanged(auth, (u: User | null) => {
      // 이전 user 리스너 해제
      if (unsubUser) { unsubUser(); unsubUser = null }

      if (!u) {
        setUser(null)
        setLoading(false)
        return
      }

      // Firestore user 문서를 실시간으로 구독
      // → 도장 업로드, 이름 변경 등 즉시 반영
      unsubUser = onSnapshot(
        doc(db, 'users', u.uid),
        snap => {
          if (snap.exists()) {
            setUser(snap.data() as AppUser)
          } else {
            setUser({
              uid:   u.uid,
              email: u.email ?? '',
              name:  u.displayName ?? u.email ?? '',
              role:  'ETC',
            })
          }
          setLoading(false)
        },
        err => {
          console.warn('Firestore user 구독 오류:', err)
          // 오류 시에도 로그아웃 방지
          setUser(prev => prev ?? {
            uid:   u.uid,
            email: u.email ?? '',
            name:  u.displayName ?? u.email ?? '',
            role:  'ETC',
          })
          setLoading(false)
        }
      )
    })

    return () => {
      unsubAuth()
      if (unsubUser) unsubUser()
    }
  }, [])

  return <Ctx.Provider value={{ user, loading }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
