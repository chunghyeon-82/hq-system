// Web Push 유틸리티
import { db } from './firebase'
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'

export function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from(Array.from(rawData).map(c => c.charCodeAt(0)))
}

export async function subscribePush(uid: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) return { ok: false, error: 'VAPID 키가 설정되지 않았습니다' }

    // Service Worker 준비 대기 (최대 10초)
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Service Worker 준비 시간 초과')), 10000)
      )
    ]) as ServiceWorkerRegistration

    // 기존 구독 확인
    const existingSub = await reg.pushManager.getSubscription()
    if (existingSub) await existingSub.unsubscribe()

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })

    await setDoc(doc(db, 'fcmTokens', uid), {
      subscription: JSON.parse(JSON.stringify(sub)),
      updatedAt: serverTimestamp(),
    })
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : '알 수 없는 오류'
    console.error('Push subscribe error:', msg)
    return { ok: false, error: msg }
  }
}

export async function unsubscribePush(uid: string): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) await sub.unsubscribe()
    await deleteDoc(doc(db, 'fcmTokens', uid))
  } catch {}
}

export async function getPushPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied'
  return Notification.permission
}
