'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import { useAuth } from './auth-context'

export type FontSize = 'small' | 'medium' | 'large'

export interface UserSettings {
  silentMode: boolean
  fontSize:   FontSize
  pushEnabled: boolean
}

const DEFAULT: UserSettings = {
  silentMode:  false,
  fontSize:    'medium',
  pushEnabled: false,
}

interface SettingsCtx {
  settings: UserSettings
  updateSettings: (patch: Partial<UserSettings>) => Promise<void>
  loading: boolean
}

const Ctx = createContext<SettingsCtx>({
  settings: DEFAULT,
  updateSettings: async () => {},
  loading: true,
})

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [settings, setSettings] = useState<UserSettings>(DEFAULT)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    getDoc(doc(db, 'userSettings', user.uid)).then(snap => {
      if (snap.exists()) setSettings({ ...DEFAULT, ...snap.data() as UserSettings })
      setLoading(false)
    })
  }, [user])

  // 글자 크기를 html data 속성으로 적용
  useEffect(() => {
    const map: Record<FontSize, string> = { small: '14px', medium: '16px', large: '18px' }
    document.documentElement.style.setProperty('--app-font-size', map[settings.fontSize])
  }, [settings.fontSize])

  const updateSettings = async (patch: Partial<UserSettings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    if (user) {
      await setDoc(doc(db, 'userSettings', user.uid),
        { ...next, updatedAt: serverTimestamp() }, { merge: true })
    }
  }

  return <Ctx.Provider value={{ settings, updateSettings, loading }}>{children}</Ctx.Provider>
}

export const useSettings = () => useContext(Ctx)
