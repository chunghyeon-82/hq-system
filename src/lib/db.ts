import {
  collection, doc, addDoc, getDocs, getDoc, updateDoc, setDoc, deleteDoc,
  query, where, orderBy, onSnapshot, serverTimestamp, arrayUnion, limit,
} from 'firebase/firestore'
import { db } from './firebase'
import type {
  AppUser, Business, Message, Receipt, Reply,
  MessageStatus, MessageType, MessageCategory,
  Notice, CalendarEvent, MessageTemplate,
  ApprovalDoc, ApprovalTemplate, SavedEmailContact, OfficialSeal,
  IncomingDoc, ApprovalLine, FooterInfo, RecipientContact, InternalDoc
} from '@/types'
function removeUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [
        k,
        v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)
          ? removeUndefined(v as Record<string, unknown>)
          : v,
      ])
  )
}
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
  // 1. 사업장 삭제
  await deleteDoc(doc(db, 'businesses', id))
  // 2. 해당 사업장이 수신자인 메시지 receipts에서 제거 (고아 메시지 방지)
  const msgsSnap = await getDocs(query(collection(db, 'messages'), where('targetBizIds', 'array-contains', id)))
  for (const msgDoc of msgsSnap.docs) {
    const data = msgDoc.data()
    const receipts = (data.receipts ?? []).filter((r: Receipt) => r.bizId !== id)
    const targetBizIds = (data.targetBizIds ?? []).filter((bid: string) => bid !== id)
    // 수신자가 아무도 없으면 메시지 삭제, 아니면 업데이트
    if (targetBizIds.length === 0 && data.type === 'broadcast') {
      await deleteDoc(msgDoc.ref)
    } else {
      await updateDoc(msgDoc.ref, { receipts, targetBizIds, updatedAt: serverTimestamp() })
    }
  }
  // 3. 해당 사업장 소속 유저의 bizId 초기화
  const usersSnap = await getDocs(query(collection(db, 'users'), where('bizId', '==', id)))
  for (const userDoc of usersSnap.docs) {
    await updateDoc(userDoc.ref, { bizId: null })
  }
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

export async function deleteMessageDoc(msgId: string) {
  await deleteDoc(doc(db, 'messages', msgId))
}

// 메시지 회수 (Recall) - 5분 이내만 가능
export async function recallMessage(msgId: string): Promise<{ ok: boolean; error?: string }> {
  const snap = await getDoc(doc(db, 'messages', msgId))
  if (!snap.exists()) return { ok: false, error: '메시지를 찾을 수 없습니다' }
  const createdAt = snap.data().createdAt?.toMillis?.() ?? 0
  if (Date.now() - createdAt > 5 * 60 * 1000) {
    return { ok: false, error: '전송 후 5분이 지나 회수할 수 없습니다' }
  }
  await deleteDoc(doc(db, 'messages', msgId))
  return { ok: true }
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
      cb(all.filter(e =>
        e.ownerUid === uid ||
        (bizId && e.targetBizIds?.includes(bizId)) ||
        e.sharedWith?.includes(uid) ||
        (e.addedBy && uid in e.addedBy)
      ))
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
// 일정 공유 - 대상자 uid 목록에게 pendingShare 설정
export async function shareEvent(
  eventId: string,
  targetUids: string[],
  targetBizIds: string[]
) {
  const pending: Record<string, boolean> = {}
  targetUids.forEach(uid => { pending[uid] = true })
  await updateDoc(doc(db, 'events', eventId), {
    sharedWith:   targetUids,
    sharedBizIds: targetBizIds,
    pendingShare: pending,
    updatedAt:    serverTimestamp(),
  })
}

// 공유 일정 수락 - 내 캘린더에 추가
export async function acceptSharedEvent(eventId: string, uid: string) {
  await updateDoc(doc(db, 'events', eventId), {
    [`addedBy.${uid}`]:       new Date().toISOString(),
    [`pendingShare.${uid}`]:  false,
    updatedAt:                serverTimestamp(),
  })
}

// 공유 일정 거절
export async function declineSharedEvent(eventId: string, uid: string) {
  await updateDoc(doc(db, 'events', eventId), {
    [`pendingShare.${uid}`]: false,
    updatedAt:               serverTimestamp(),
  })
}

// 내게 공유 대기 중인 일정 조회
export function listenPendingSharedEvents(uid: string, cb: (e: import('@/types').CalendarEvent[]) => void) {
  return onSnapshot(
    collection(db, 'events'),
    snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as import('@/types').CalendarEvent))
      cb(all.filter(e => e.pendingShare?.[uid] === true))
    }
  )
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

// ── 품의서 결재 ─────────────────────────────────────────

export function listenApprovalDocs(uid: string, cb: (docs: ApprovalDoc[]) => void) {
  return onSnapshot(
    query(collection(db, 'approvals'), orderBy('createdAt', 'desc')),
    snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as ApprovalDoc))
      cb(all.filter(d =>
        d.authorUid === uid ||
        d.approvers?.some(a => a.uid === uid) ||
        d.finalApprover?.uid === uid ||
        d.viewers?.some(v => v.uid === uid)
      ))
    }
  )
}

export async function createApprovalDoc(data: Omit<ApprovalDoc, 'id' | 'createdAt'>) {
  const clean = removeUndefined(data as Record<string, unknown>)
  return await addDoc(collection(db, 'approvals'), {
    ...clean,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateApprovalDoc(id: string, data: Partial<ApprovalDoc>) {
  const clean = removeUndefined(data as Record<string, unknown>)
  await updateDoc(doc(db, 'approvals', id), {
    ...clean,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteApprovalDoc(id: string) {
  await deleteDoc(doc(db, 'approvals', id))
}

// 템플릿
export function listenApprovalTemplates(uid: string, cb: (templates: ApprovalTemplate[]) => void) {
  return onSnapshot(
    query(collection(db, 'approvalTemplates'), where('ownerUid', '==', uid)),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as ApprovalTemplate)))
  )
}

export async function saveApprovalTemplate(data: Omit<ApprovalTemplate, 'id' | 'createdAt'>) {
  return await addDoc(collection(db, 'approvalTemplates'), {
    ...data,
    createdAt: serverTimestamp(),
  })
}

export async function deleteApprovalTemplate(id: string) {
  await deleteDoc(doc(db, 'approvalTemplates', id))
}

// 저장된 이메일 연락처
export function listenSavedContacts(uid: string, cb: (contacts: SavedEmailContact[]) => void) {
  return onSnapshot(
    query(collection(db, 'emailContacts'), where('ownerUid', '==', uid)),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedEmailContact)))
  )
}

export async function saveEmailContact(uid: string, name: string, email: string) {
  return await addDoc(collection(db, 'emailContacts'), {
    name, email, ownerUid: uid, createdAt: serverTimestamp(),
  })
}

export async function deleteEmailContact(id: string) {
  await deleteDoc(doc(db, 'emailContacts', id))
}

// ── 기관 직인 관리 (관리자) ──────────────────────────────
export function listenOfficialSeals(cb: (seals: OfficialSeal[]) => void) {
  return onSnapshot(
    query(collection(db, 'officialSeals'), orderBy('createdAt', 'desc')),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as OfficialSeal)))
  )
}

export async function addOfficialSeal(name: string, imageUrl: string, ownerUid: string) {
  return await addDoc(collection(db, 'officialSeals'), {
    name, imageUrl, ownerUid, createdAt: serverTimestamp()
  })
}

export async function deleteOfficialSeal(id: string) {
  await deleteDoc(doc(db, 'officialSeals', id))
}

// 개인 도장 저장 (users 컬렉션의 sealUrl 필드)
export async function updateUserSeal(uid: string, sealUrl: string) {
  await updateDoc(doc(db, 'users', uid), { sealUrl })
}

// ── 공문 접수 ─────────────────────────────────────────
export function listenIncomingDocs(uid: string, cb: (docs: IncomingDoc[]) => void) {
  return onSnapshot(
    query(collection(db, 'incomingDocs'), orderBy('createdAt', 'desc')),
    snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as IncomingDoc))
      cb(all.filter(d =>
        d.authorUid === uid ||
        d.approvers?.some(a => a.uid === uid) ||
        d.finalApprover?.uid === uid
      ))
    }
  )
}

export async function createIncomingDoc(data: Omit<IncomingDoc, 'id' | 'createdAt'>) {
  return await addDoc(collection(db, 'incomingDocs'), {
    ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
}

export async function updateIncomingDoc(id: string, data: Partial<IncomingDoc>) {
  const clean = removeUndefined(data as Record<string, unknown>)
  await updateDoc(doc(db, 'incomingDocs', id), { ...clean, updatedAt: serverTimestamp() })
}

export async function deleteIncomingDoc(id: string) {
  await deleteDoc(doc(db, 'incomingDocs', id))
}

// ── 결재선 관리 ───────────────────────────────────────
export function listenApprovalLines(uid: string, cb: (lines: ApprovalLine[]) => void) {
  return onSnapshot(
    query(collection(db, 'approvalLines'), where('ownerUid', '==', uid)),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as ApprovalLine)))
  )
}

export async function saveApprovalLine(data: Omit<ApprovalLine, 'id' | 'createdAt'>) {
  return await addDoc(collection(db, 'approvalLines'), {
    ...data, createdAt: serverTimestamp(),
  })
}

export async function deleteApprovalLine(id: string) {
  await deleteDoc(doc(db, 'approvalLines', id))
}

export async function updateApprovalLine(id: string, data: Partial<import('@/types').ApprovalLine>) {
  await updateDoc(doc(db, 'approvalLines', id), { ...data })
}

// ── 하단 발신 정보 ─────────────────────────────────────
export async function saveFooterInfo(uid: string, info: FooterInfo) {
  await setDoc(doc(db, 'userSettings', uid), { footerInfo: info }, { merge: true })
}

export async function getFooterInfo(uid: string): Promise<FooterInfo | null> {
  const snap = await getDoc(doc(db, 'userSettings', uid))
  return snap.exists() ? (snap.data().footerInfo ?? null) : null
}

// ── 수신자 연락처 관리 ─────────────────────────────────
export function listenRecipientContacts(uid: string, cb: (c: RecipientContact[]) => void) {
  return onSnapshot(
    query(collection(db, 'recipientContacts'),
      where('ownerUid', '==', uid),
      orderBy('createdAt', 'desc')),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as RecipientContact)))
  )
}

export async function addRecipientContact(data: Omit<RecipientContact, 'id' | 'createdAt'>) {
  return await addDoc(collection(db, 'recipientContacts'), {
    ...data, createdAt: serverTimestamp()
  })
}

export async function deleteRecipientContact(id: string) {
  await deleteDoc(doc(db, 'recipientContacts', id))
}

// ── 내부 품의서 ────────────────────────────────────────
export function listenInternalDocs(uid: string, cb: (docs: InternalDoc[]) => void) {
  return onSnapshot(
    query(collection(db, 'internalDocs'), orderBy('createdAt', 'desc')),
    snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as InternalDoc))
      cb(all.filter(d =>
        d.authorUid === uid ||
        d.approvers?.some(a => a.uid === uid) ||
        d.finalApprover?.uid === uid
      ))
    }
  )
}

export async function createInternalDoc(data: Omit<InternalDoc, 'id' | 'createdAt'>) {
  const clean = removeUndefined(data as Record<string, unknown>)
  return await addDoc(collection(db, 'internalDocs'), {
    ...clean, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
}

export async function updateInternalDoc(id: string, data: Partial<InternalDoc>) {
  const clean = removeUndefined(data as Record<string, unknown>)
  await updateDoc(doc(db, 'internalDocs', id), { ...clean, updatedAt: serverTimestamp() })
}

export async function deleteInternalDoc(id: string) {
  await deleteDoc(doc(db, 'internalDocs', id))
}
