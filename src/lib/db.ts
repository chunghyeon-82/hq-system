import {
  collection, doc, addDoc, getDocs, getDoc, updateDoc, setDoc, deleteDoc,
  query, where, orderBy, onSnapshot, serverTimestamp, arrayUnion, limit,
} from 'firebase/firestore'
import { db } from './firebase'
import type {
  AppUser, Business, Message, Receipt, Reply,
  MessageStatus, MessageType, MessageCategory,
  Notice, CalendarEvent, MessageTemplate
} from '@/types'

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
export function listenMessagesForHQ(uid: string, isAdmin: boolean, cb: (m: Message[]) => void) {
  return onSnapshot(
    query(collection(db, 'messages'), orderBy('createdAt', 'desc')),
    snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message))
      if (isAdmin) { cb(all); return }
      cb(all.filter(m =>
        m.type === 'broadcast' ||
        (m.type === 'direct' && (m.targetUid === uid || m.authorUid === uid))
      ))
    }
  )
}

export function listenMessagesForBiz(bizId: string, uid: string, cb: (m: Message[]) => void) {
  return onSnapshot(
    query(collection(db, 'messages'), orderBy('createdAt', 'desc')),
    snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message))
      cb(all.filter(m => {
        if (m.type === 'broadcast') return m.targetBizIds.includes(bizId)
        if (m.type === 'direct')   return m.authorUid === uid || m.targetUid === uid
        return false
      }))
    }
  )
}

export function listenMessages(cb: (m: Message[]) => void) {
  return onSnapshot(
    query(collection(db, 'messages'), orderBy('createdAt', 'desc')),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)))
  )
}

// broadcast 발송
export async function sendMessage(
  data: Omit<Message, 'id' | 'createdAt' | 'updatedAt' | 'replies' | 'status' | 'type'>
) {
  await addDoc(collection(db, 'messages'), {
    ...data,
    type:    'broadcast' as MessageType,
    status:  'open' as MessageStatus,
    replies: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

// direct 발송
export async function sendDirectMessage(data: {
  title:        string
  body:         string
  category:     MessageCategory
  priority:     'normal' | 'urgent'
  authorUid:    string
  authorName:   string
  authorBizId:  string
  targetUid:    string
  targetName:   string
}) {
  await addDoc(collection(db, 'messages'), {
    ...data,
    type:         'direct' as MessageType,
    targetBizIds: [],
    receipts:     [],
    replies:      [],
    status:       'open' as MessageStatus,
    createdAt:    serverTimestamp(),
    updatedAt:    serverTimestamp(),
  })
}

// ── 처리하겠습니다 (미접수 → 처리중) ─────────────────
export async function processMessage(msgId: string, bizId: string) {
  const ref  = doc(db, 'messages', msgId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const receipts: Receipt[] = snap.data().receipts || []
  const updated = receipts.map(r =>
    r.bizId === bizId && r.status === 'pending'
      ? { ...r, status: 'processing' as const, processedAt: now() } : r
  )
  await updateDoc(ref, { receipts: updated, updatedAt: serverTimestamp() })
}

// ── 처리했습니다 (미접수/처리중 → 완료) ──────────────
export async function completeMessage(msgId: string, bizId: string, note?: string) {
  const ref  = doc(db, 'messages', msgId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const receipts: Receipt[] = snap.data().receipts || []
  const updated = receipts.map(r =>
    r.bizId === bizId
      ? { ...r, status: 'done' as const, doneAt: now(), doneNote: note ?? '' } : r
  )
  // 모든 사업장이 완료되면 메시지도 done 처리
  const allDone = updated.every(r => r.status === 'done')
  await updateDoc(ref, {
    receipts: updated,
    ...(allDone ? { status: 'done' as MessageStatus } : {}),
    updatedAt: serverTimestamp(),
  })
}

// direct 답변
export async function replyDirect(msgId: string, authorUid: string, authorName: string, body: string) {
  const newReply: Reply = {
    id: Date.now().toString(),
    bizId: '', bizName: '', authorUid, authorName, body, createdAt: now(),
  }
  await updateDoc(doc(db, 'messages', msgId), {
    replies:   arrayUnion(newReply),
    updatedAt: serverTimestamp(),
  })
}

export async function closeMessage(msgId: string) {
  await updateDoc(doc(db, 'messages', msgId), { status: 'done' as MessageStatus, updatedAt: serverTimestamp() })
}
export async function reopenMessage(msgId: string) {
  await updateDoc(doc(db, 'messages', msgId), { status: 'open' as MessageStatus, updatedAt: serverTimestamp() })
}
export async function hideMessage(msgId: string, bizId: string) {
  const ref  = doc(db, 'messages', msgId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const receipts: Receipt[] = snap.data().receipts || []
  const updated = receipts.map(r =>
    r.bizId === bizId ? { ...r, hidden: true, hiddenAt: now() } : r
  )
  await updateDoc(ref, { receipts: updated, updatedAt: serverTimestamp() })
}

// ── HQ 채팅 ───────────────────────────────────────────
const HQ_BIZ_NAME = '운영본부'
export async function ensureHQBusiness(): Promise<string> {
  const snap = await getDocs(query(collection(db, 'businesses'), where('isHQ', '==', true)))
  if (!snap.empty) return snap.docs[0].id
  const ref = await addDoc(collection(db, 'businesses'), {
    name: HQ_BIZ_NAME, isHQ: true, createdAt: serverTimestamp(),
  })
  return ref.id
}

export interface ChatMessage {
  id:         string
  authorUid:  string
  authorName: string
  authorRole: string
  body:       string
  createdAt:  unknown
}
export function listenChatMessages(viewerRole: string, cb: (msgs: ChatMessage[]) => void) {
  return onSnapshot(
    query(collection(db, 'hq_chat'), orderBy('createdAt', 'asc'), limit(200)),
    snap => {
      const all: ChatMessage[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage))
      cb(viewerRole === 'ADMIN' ? all : all.filter(m => m.authorRole !== 'ADMIN'))
    }
  )
}
export async function sendChatMessage(authorUid: string, authorName: string, authorRole: string, body: string) {
  await addDoc(collection(db, 'hq_chat'), { authorUid, authorName, authorRole, body, createdAt: serverTimestamp() })
}

// ── 공지사항 ──────────────────────────────────────────
export function listenNotices(cb: (n: Notice[]) => void) {
  const n = new Date().toISOString()
  return onSnapshot(
    query(collection(db, 'notices'), orderBy('createdAt', 'desc')),
    snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Notice))
      cb(all.filter(x => x.expiresAt > n))
    }
  )
}
export async function addNotice(data: Omit<Notice, 'id' | 'createdAt'>) {
  return addDoc(collection(db, 'notices'), { ...data, createdAt: serverTimestamp() })
}
export async function deleteNotice(id: string) {
  await deleteDoc(doc(db, 'notices', id))
}

// ── 캘린더 ────────────────────────────────────────────
export function listenEvents(uid: string, bizId: string | undefined, cb: (e: CalendarEvent[]) => void) {
  return onSnapshot(
    query(collection(db, 'events'), orderBy('date', 'asc')),
    snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as CalendarEvent))
      cb(all.filter(e => e.ownerUid === uid || (bizId && e.targetBizIds?.includes(bizId))))
    }
  )
}
export async function addEvent(data: Omit<CalendarEvent, 'id' | 'createdAt'>) {
  return addDoc(collection(db, 'events'), { ...data, createdAt: serverTimestamp() })
}
export async function updateEvent(id: string, data: Partial<CalendarEvent>) {
  await updateDoc(doc(db, 'events', id), { ...data, updatedAt: serverTimestamp() })
}
export async function deleteEvent(id: string) {
  await deleteDoc(doc(db, 'events', id))
}
export async function addEventToMyCalendar(eventId: string, bizId: string) {
  await updateDoc(doc(db, 'events', eventId), {
    [`addedBy.${bizId}`]: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  })
}

// ── 템플릿 ────────────────────────────────────────────
export function listenTemplates(uid: string, cb: (t: MessageTemplate[]) => void) {
  return onSnapshot(
    query(collection(db, 'templates'), where('ownerUid', '==', uid), orderBy('createdAt', 'desc')),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as MessageTemplate)))
  )
}
export async function addTemplate(data: Omit<MessageTemplate, 'id' | 'createdAt'>) {
  return addDoc(collection(db, 'templates'), { ...data, createdAt: serverTimestamp() })
}
export async function deleteTemplate(id: string) {
  await deleteDoc(doc(db, 'templates', id))
}

// ── 사업장 순서 ───────────────────────────────────────
export async function getBizOrder(uid: string): Promise<string[]> {
  const snap = await getDoc(doc(db, 'bizOrder', uid))
  return snap.exists() ? (snap.data().order as string[]) : []
}
export async function saveBizOrder(uid: string, order: string[]) {
  await setDoc(doc(db, 'bizOrder', uid), { order, updatedAt: serverTimestamp() })
}
