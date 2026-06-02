'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import type { AppUser } from '@/types'

interface AuthCtx { user: AppUser | null; loading: boolean }
const Ctx = createContext<AuthCtx>({ user: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, async (u: User | null) => {
      if (!u) {
        setUser(null)
        setLoading(false)
        return
      }

      // Firebase Auth는 유효한데 Firestore 읽기 실패 시 로그아웃 방지
      // 최대 3번 재시도
      let retries = 3
      while (retries > 0) {
        try {
          const snap = await getDoc(doc(db, 'users', u.uid))
          if (snap.exists()) {
            setUser(snap.data() as AppUser)
          } else {
            // Firestore에 유저 문서가 없는 경우 — Firebase Auth 정보로 최소한 설정
            setUser({
              uid:   u.uid,
              email: u.email ?? '',
              name:  u.displayName ?? u.email ?? '',
              role:  'ETC',
            })
          }
          break
        } catch (e) {
          retries--
          if (retries === 0) {
            // 최종 실패 시에도 로그인 상태 유지 (로그아웃 방지)
            console.warn('Firestore 유저 읽기 실패, 재시도 초과:', e)
            setUser({
              uid:   u.uid,
              email: u.email ?? '',
              name:  u.displayName ?? u.email ?? '',
              role:  'ETC',
            })
          } else {
            // 잠시 후 재시도
            await new Promise(r => setTimeout(r, 1000))
          }
        }
      }
      setLoading(false)
    })
  }, [])

  return <Ctx.Provider value={{ user, loading }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
