import {
  collection, doc, addDoc, getDoc, updateDoc, setDoc, deleteDoc,
  query, where, orderBy, onSnapshot, serverTimestamp, arrayUnion, or,
} from 'firebase/firestore'
import { db } from './firebase'
import type { AppUser, Business, Message, Receipt, Reply, MessageStatus, MessageType } from '@/types'

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

// 본부용: 전체 broadcast 메시지 + 자신이 수신자인 direct 메시지
export function listenMessagesForHQ(uid: string, isAdmin: boolean, cb: (m: Message[]) => void) {
  if (isAdmin) {
    // 관리자: 모든 메시지
    return onSnapshot(
      query(collection(db, 'messages'), orderBy('createdAt', 'desc')),
      snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)))
    )
  }
  // 일반 본부멤버: broadcast + 자신이 targetUid인 direct
  return onSnapshot(
    query(collection(db, 'messages'), orderBy('createdAt', 'desc')),
    snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message))
      cb(all.filter(m =>
        m.type === 'broadcast' ||
        (m.type === 'direct' && (m.targetUid === uid || m.authorUid === uid))
      ))
    }
  )
}

// 사업장 대표용: 자기 사업장으로 온 broadcast + 자신이 보내거나 받은 direct
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

// 하위 호환
export function listenMessages(cb: (m: Message[]) => void) {
  return onSnapshot(
    query(collection(db, 'messages'), orderBy('createdAt', 'desc')),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)))
  )
}
export function listenMessagesByBiz(bizId: string, cb: (m: Message[]) => void) {
  return onSnapshot(
    query(collection(db, 'messages'), where('targetBizIds', 'array-contains', bizId), orderBy('createdAt', 'desc')),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)))
  )
}

// broadcast 발송 (본부 → 여러 사업장)
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

// direct 발송 (사업장 대표 → 특정 본부 멤버)
export async function sendDirectMessage(data: {
  title:        string
  body:         string
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

// 사업장이 broadcast 접수확인
export async function receiveMessage(msgId: string, bizId: string) {
  const ref  = doc(db, 'messages', msgId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const receipts: Receipt[] = snap.data().receipts || []
  const updated = receipts.map(r =>
    r.bizId === bizId && r.status === 'pending'
      ? { ...r, status: 'received' as const, receivedAt: now() } : r
  )
  await updateDoc(ref, { receipts: updated, updatedAt: serverTimestamp() })
}

// 사업장이 broadcast 답변
export async function replyMessage(
  msgId: string, bizId: string, bizName: string,
  authorUid: string, authorName: string, body: string
) {
  const ref  = doc(db, 'messages', msgId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const receipts: Receipt[] = snap.data().receipts || []
  const newReply: Reply = {
    id: Date.now().toString(),
    bizId, bizName, authorUid, authorName, body, createdAt: now(),
  }
  const updated = receipts.map(r =>
    r.bizId === bizId ? { ...r, status: 'replied' as const, repliedAt: now() } : r
  )
  await updateDoc(ref, {
    replies: arrayUnion(newReply),
    receipts: updated,
    updatedAt: serverTimestamp(),
  })
}

// direct 메시지 답변 (본부 → 사업장 대표)
export async function replyDirect(
  msgId: string, authorUid: string, authorName: string, body: string
) {
  const newReply: Reply = {
    id: Date.now().toString(),
    bizId: '', bizName: '', authorUid, authorName, body, createdAt: now(),
  }
  await updateDoc(doc(db, 'messages', msgId), {
    replies:   arrayUnion(newReply),
    status:    'open' as MessageStatus,
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

// ── 운영본부 자동 생성/조회 ────────────────────────────
const HQ_BIZ_NAME = '운영본부'

export async function ensureHQBusiness(): Promise<string> {
  const { getDocs, query, where, collection: col, addDoc: add, serverTimestamp: sts } = await import('firebase/firestore')
  const snap = await getDocs(query(col(db, 'businesses'), where('isHQ', '==', true)))
  if (!snap.empty) return snap.docs[0].id
  // 없으면 생성
  const ref = await add(col(db, 'businesses'), {
    name: HQ_BIZ_NAME,
    isHQ: true,
    createdAt: sts(),
  })
  return ref.id
}

// ── 운영본부 단체채팅 ──────────────────────────────────
export interface ChatMessage {
  id:         string
  authorUid:  string
  authorName: string
  body:       string
  createdAt:  unknown
}

export function listenChatMessages(cb: (msgs: ChatMessage[]) => void) {
  const { query, collection: col, orderBy: ob, onSnapshot: ons, limit } = require('firebase/firestore')
  return ons(
    query(col(db, 'hq_chat'), ob('createdAt', 'asc'), limit(200)),
    (snap: any) => cb(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })))
  )
}

export async function sendChatMessage(authorUid: string, authorName: string, body: string) {
  const { collection: col, addDoc: add, serverTimestamp: sts } = await import('firebase/firestore')
  await add(col(db, 'hq_chat'), { authorUid, authorName, body, createdAt: sts() })
}
