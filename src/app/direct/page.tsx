'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

// 1:1 채팅은 MessengerShell에 통합됨 → 메인 페이지(/)로 리다이렉트
export default function DirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/')
  }, [router])
  return null
}
