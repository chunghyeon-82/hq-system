// Web Push 유틸리티
import { db } from './firebase'
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'

export function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export async function subscribePush(uid: string): Promise<boolean> {
  try {
    const reg = await navigator.serviceWorker.ready
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) return false

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })

    await setDoc(doc(db, 'fcmTokens', uid), {
      subscription: JSON.parse(JSON.stringify(sub)),
      updatedAt: serverTimestamp(),
    })
    return true
  } catch {
    return false
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
