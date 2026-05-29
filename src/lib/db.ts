// src/lib/db.ts
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot, serverTimestamp, Timestamp,
  arrayUnion,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Business, Message, AppUser, Receipt, Reply, MessageStatus } from '@/types'

const now = () => new Date().toISOString()
const tsToStr = (v: unknown): string => {
  if (!v) return ''
  if (v instanceof Timestamp) return v.toDate().toISOString()
  return String(v)
}

// ── 사용자 ──────────────────────────────────────────────
export async function getUser(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  return { uid: snap.id, ...snap.data() } as AppUser
}

export async function upsertUser(user: AppUser) {
  await updateDoc(doc(db, 'users', user.uid), { ...user })
}

export function listenUsers(cb: (users: AppUser[]) => void) {
  return onSnapshot(collection(db, 'users'), snap => {
    cb(snap.docs.map(d => ({ uid: d.id, ...d.data() } as AppUser)))
  })
}

// ── 사업장 ──────────────────────────────────────────────
export async function getBusinesses(): Promise<Business[]> {
  const snap = await getDocs(query(collection(db, 'businesses'), orderBy('createdAt', 'asc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Business))
}

export function listenBusinesses(cb: (list: Business[]) => void) {
  return onSnapshot(
    query(collection(db, 'businesses'), orderBy('createdAt', 'asc')),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Business)))
  )
}

export async function getBusiness(id: string): Promise<Business | null> {
  const snap = await getDoc(doc(db, 'businesses', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Business
}

export async function addBusiness(data: Omit<Business, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'businesses'), { ...data, createdAt: now(), updatedAt: now() })
  return ref.id
}

export async function updateBusiness(id: string, data: Partial<Business>) {
  await updateDoc(doc(db, 'businesses', id), { ...data, updatedAt: now() })
}

export async function deleteBusiness(id: string) {
  await deleteDoc(doc(db, 'businesses', id))
}

// ── 메시지 ──────────────────────────────────────────────
export function listenMessages(bizId: string | null, cb: (msgs: Message[]) => void) {
  const q = bizId
    ? query(
        collection(db, 'messages'),
        where('targetBizIds', 'array-contains', bizId),
        orderBy('createdAt', 'desc')
      )
    : query(collection(db, 'messages'), orderBy('createdAt', 'desc'))

  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => {
      const data = d.data()
      return {
        id: d.id,
        ...data,
        createdAt: tsToStr(data.createdAt),
        updatedAt: tsToStr(data.updatedAt),
        replies: (data.replies || []).map((r: Reply & { createdAt: unknown }) => ({
          ...r,
          createdAt: tsToStr(r.createdAt),
        })),
        receipts: data.receipts || [],
      } as Message
    }))
  })
}

export async function sendMessage(data: {
  title: string
  body: string
  priority: 'normal' | 'urgent'
  fromUid: string
  fromName: string
  fromRole: string
  fromBizId?: string
  targetBizIds: string[]
  receipts: Receipt[]
}) {
  await addDoc(collection(db, 'messages'), {
    ...data,
    replies: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function markReceived(msgId: string, bizId: string, bizName: string) {
  const ref = doc(db, 'messages', msgId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const receipts: Receipt[] = snap.data().receipts || []
  const updated = receipts.map(r =>
    r.bizId === bizId && r.status === 'pending'
      ? { ...r, status: 'received' as MessageStatus, receivedAt: now() }
      : r
  )
  await updateDoc(ref, { receipts: updated, updatedAt: serverTimestamp() })
}

export async function addReply(msgId: string, bizId: string, reply: Omit<Reply, 'id'>) {
  const ref = doc(db, 'messages', msgId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const newReply: Reply = { ...reply, id: crypto.randomUUID(), createdAt: now() }
  const receipts: Receipt[] = snap.data().receipts || []
  const updated = receipts.map(r =>
    r.bizId === bizId
      ? { ...r, status: 'replied' as MessageStatus, repliedAt: now() }
      : r
  )
  await updateDoc(ref, {
    replies: arrayUnion(newReply),
    receipts: updated,
    updatedAt: serverTimestamp(),
  })
}

// 메시지 숨기기 (해당 사업장에서만 숨김, 본부에는 유지)
export async function hideMessage(msgId: string, bizId: string) {
  const ref = doc(db, 'messages', msgId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const receipts: Receipt[] = snap.data().receipts || []
  const updated = receipts.map(r =>
    r.bizId === bizId
      ? { ...r, hidden: true, hiddenAt: now() }
      : r
  )
  await updateDoc(ref, { receipts: updated, updatedAt: serverTimestamp() })
}
