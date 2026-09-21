'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import MessengerShell from '@/components/MessengerShell'

export default function Root() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const redirected = useRef(false)

  useEffect(() => {
    if (loading) return
    if (redirected.current) return
    if (!user) {
      redirected.current = true
      router.replace('/login')
    }
  }, [user, loading, router])

  if (loading || !user) return null

  return <MessengerShell/>
}
