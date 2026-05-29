import {
  collection, doc, addDoc, getDoc, updateDoc, setDoc, deleteDoc,
  query, where, orderBy, onSnapshot, serverTimestamp, arrayUnion,
  Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import type { AppUser, Business, Message, Receipt, Reply, MessageStatus } from '@/types'

const now = () => new Date().toISOString()

// ── Users ─────────────────────────────────────────────
export function listenUsers(cb: (u: AppUser[]) => void) {
  return onSnapshot(collection(db, 'users'), snap =>
    cb(snap.docs.map(d => d.data() as AppUser))
  )
}
export async function upsertUser(data: AppUser) {
  await setDoc(doc(db, 'users', data.uid), data, { merge: true })
}

// ── Businesses ────────────────────────────────────────
export function listenBusinesses(cb: (b: Business[]) => void) {
  return onSnapshot(
    query(collection(db, 'businesses'), orderBy('name')),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Business)))
  )
}
export async function addBusiness(data: Omit<Business, 'id'>) {
  await addDoc(collection(db, 'businesses'), { ...data, createdAt: serverTimestamp() })
}
export async function updateBusiness(id: string, data: Partial<Business>) {
  await updateDoc(doc(db, 'businesses', id), data)
}
export async function deleteBusiness(id: string) {
  await deleteDoc(doc(db, 'businesses', id))
}

// ── Messages ──────────────────────────────────────────
export function listenMessages(cb: (m: Message[]) => void) {
  return onSnapshot(
    query(collection(db, 'messages'), orderBy('createdAt', 'desc')),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)))
  )
}
export function listenMessagesByBiz(bizId: string, cb: (m: Message[]) => void) {
  return onSnapshot(
    query(
      collection(db, 'messages'),
      where('targetBizIds', 'array-contains', bizId),
      orderBy('createdAt', 'desc')
    ),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)))
  )
}
export async function sendMessage(
  data: Omit<Message, 'id' | 'createdAt' | 'updatedAt' | 'replies' | 'status'>
) {
  await addDoc(collection(db, 'messages'), {
    ...data,
    status: 'open' as MessageStatus,
    replies: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

// 사업장이 접수확인
export async function receiveMessage(msgId: string, bizId: string) {
  const ref = doc(db, 'messages', msgId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const receipts: Receipt[] = snap.data().receipts || []
  const updated = receipts.map(r =>
    r.bizId === bizId && r.status === 'pending'
      ? { ...r, status: 'received' as const, receivedAt: now() }
      : r
  )
  await updateDoc(ref, { receipts: updated, updatedAt: serverTimestamp() })
}

// 사업장이 답변 등록
export async function replyMessage(msgId: string, bizId: string, bizName: string, authorUid: string, authorName: string, body: string) {
  const ref = doc(db, 'messages', msgId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const receipts: Receipt[] = snap.data().receipts || []
  const newReply: Reply = {
    id: Date.now().toString(),
    bizId, bizName, authorUid, authorName, body,
    createdAt: now(),
  }
  const updated = receipts.map(r =>
    r.bizId === bizId
      ? { ...r, status: 'replied' as const, repliedAt: now() }
      : r
  )
  await updateDoc(ref, {
    replies: arrayUnion(newReply),
    receipts: updated,
    updatedAt: serverTimestamp(),
  })
}

// 본부가 메시지 완결 처리
export async function closeMessage(msgId: string) {
  await updateDoc(doc(db, 'messages', msgId), {
    status: 'done' as MessageStatus,
    updatedAt: serverTimestamp(),
  })
}

// 본부가 메시지 재오픈
export async function reopenMessage(msgId: string) {
  await updateDoc(doc(db, 'messages', msgId), {
    status: 'open' as MessageStatus,
    updatedAt: serverTimestamp(),
  })
}

// 사업장에서 메시지 숨기기
export async function hideMessage(msgId: string, bizId: string) {
  const ref = doc(db, 'messages', msgId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const receipts: Receipt[] = snap.data().receipts || []
  const updated = receipts.map(r =>
    r.bizId === bizId ? { ...r, hidden: true, hiddenAt: now() } : r
  )
  await updateDoc(ref, { receipts: updated, updatedAt: serverTimestamp() })
}
