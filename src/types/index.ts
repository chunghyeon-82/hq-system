export type UserRole = 'ADMIN' | 'HQ_CHIEF' | 'HQ_MEMBER' | 'BIZ_REP' | 'ETC'

export interface UserPermissions {
  canEditBusiness?: boolean
  canBroadcast?:    boolean
}

export interface AppUser {
  uid:          string
  email:        string
  name:         string
  role:         UserRole
  customRole?:  string
  bizId?:       string
  permissions?: UserPermissions
}

export interface Shareholder { name: string; shares: number }

export interface Business {
  id:             string
  name:           string
  address?:       string
  repName?:       string
  repUid?:        string
  phone?:         string
  totalShares?:   number
  shareholders?:  Shareholder[]
  employeeCount?: number
  annualRevenue?: number
  isHQ?:          boolean
  createdAt?:     unknown
}

export type MessagePriority = 'normal' | 'urgent'
export type MessageStatus   = 'open' | 'done'
export type MessageType     = 'broadcast' | 'direct'

// 전달 종류 (업무지시 / 확인요청 / 단순공지)
export type MessageCategory = 'instruction' | 'confirm' | 'notice'

// 사업장별 처리 상태
// pending   = 미접수
// processing = 처리하겠습니다 (처리중)
// done      = 처리했습니다 (완료)
export type ReceiptStatus = 'pending' | 'processing' | 'done'

export interface Receipt {
  bizId:        string
  bizName:      string
  status:       ReceiptStatus
  processedAt?: string   // 처리하겠습니다 누른 시각
  doneAt?:      string   // 처리했습니다 시각
  doneNote?:    string   // 완료 보고 내용
  hidden?:      boolean
  hiddenAt?:    string
}

export interface Reply {
  id:         string
  bizId:      string
  bizName:    string
  authorUid:  string
  authorName: string
  body:       string
  createdAt:  string
}

export interface Message {
  id:            string
  title:         string
  body:          string
  category:      MessageCategory
  priority:      MessagePriority
  type:          MessageType
  authorUid:     string
  authorName:    string
  authorBizId?:  string
  targetBizIds:  string[]
  targetUid?:    string
  targetName?:   string
  status:        MessageStatus
  receipts:      Receipt[]
  replies:       Reply[]
  eventDate?:    string
  eventTime?:    string
  eventTitle?:   string
  linkUrl?:      string
  linkLabel?:    string
  createdAt:     unknown
  updatedAt:     unknown
}

// ── 공지사항 ──────────────────────────────────────────
export type NoticePrefix = '본부' | '사업장'

export interface Notice {
  id:          string
  prefix:      NoticePrefix
  title:       string
  body:        string
  authorUid:   string
  authorName:  string
  expiresAt:   string
  createdAt:   unknown
  updatedAt?:  unknown
}

// ── 캘린더 일정 ───────────────────────────────────────
export type ReminderUnit = 'minutes' | 'hours' | 'days'

export interface EventReminder {
  value: number
  unit:  ReminderUnit
}

export interface CalendarEvent {
  id:            string
  title:         string
  date:          string
  time?:         string
  memo?:         string
  location?:     string        // 장소
  isImportant?:  boolean       // 주요일정 여부
  ownerUid:      string
  ownerName:     string
  sharedWith?:   string[]      // 공유 대상 uid 목록
  sharedBizIds?: string[]      // 공유 사업장 id 목록
  targetBizIds?: string[]
  reminder?:     EventReminder
  isDone:        boolean
  doneAt?:       string
  addedBy?:      Record<string, string>   // uid → 수락시각
  pendingShare?: Record<string, boolean>  // uid → 수락 대기
  createdAt:     unknown
  updatedAt?:    unknown
}

// ── 메시지 템플릿 ─────────────────────────────────────
export interface MessageTemplate {
  id:        string
  ownerUid:  string
  title:     string
  body:      string
  createdAt: unknown
}
