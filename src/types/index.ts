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
  sealUrl?:    string   // 개인 도장 이미지 URL
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

// ── 품의서 결재 시스템 ─────────────────────────────────

export type ApprovalStatus = 'draft' | 'pending' | 'approved' | 'rejected'
export type ApproverStatus = 'waiting' | 'approved' | 'rejected' | 'submitted'

export interface Approver {
  uid:        string
  name:       string
  role:       string        // 직책명 (직접 입력)
  status:     ApproverStatus
  comment?:   string        // 결재 의견
  actedAt?:   string        // 결재 시각
  sealUrl?:   string        // 도장 이미지 URL
}

export interface Attachment {
  name:  string
  url:   string
  size?: number
}

export interface EmailContact {
  name:  string
  email: string
  saved: boolean  // 저장된 연락처 여부
}

export interface ApprovalDoc {
  id:           string
  docNo:        string        // 문서번호 (직접 입력)
  title:        string        // 제목
  orgName:      string        // 조직명
  recipient:    string        // 수신자
  via?:         string        // 경유
  body:         string        // 본문
  attachments:  Attachment[]  // 붙임 파일
  templateId?:  string        // 사용한 템플릿 ID
  sealOrgName:  string        // 직인 위 조직명 (예: 기획운영본부장)
  sealUrl?:     string        // 직인 이미지 URL

  // 결재선
  drafter:      Approver      // 기안자
  approvers:    Approver[]    // 중간결재자 (0~5명)
  finalApprover: Approver     // 최종결재자
  viewers:      Approver[]    // 공람자

  // 하단 정보
  address?:     string
  zipCode?:     string
  phone?:       string
  fax?:         string
  email?:       string
  homepage?:    string
  isPublic:     '공개' | '부분공개' | '비공개(1)' | '비공개(2)' | '비공개(3)' | '비공개(4)' | '비공개(5)' | '비공개(6)' | '비공개(7)'

  // 상태
  status:       ApprovalStatus
  currentStep:  number        // 현재 결재 단계 (0: 기안자, 1~: 중간결재자, 999: 최종)
  authorUid:    string
  createdAt:    unknown
  updatedAt?:   unknown
  approvedAt?:  string        // 최종 승인 시각
  rejectedAt?:  string        // 반려 시각
}

export interface ApprovalTemplate {
  id:          string
  name:        string        // 템플릿 이름
  orgName:     string
  sealOrgName: string
  body:        string
  address?:    string
  zipCode?:    string
  phone?:      string
  fax?:        string
  email?:      string
  homepage?:   string
  ownerUid:    string
  createdAt:   unknown
}

export interface SavedEmailContact {
  id:        string
  name:      string
  email:     string
  ownerUid:  string
  createdAt: unknown
}

// ── 직인 관리 ─────────────────────────────────────────
export interface OfficialSeal {
  id:        string
  name:      string   // 직인 이름 (예: 기획운영본부장)
  imageUrl:  string   // Firebase Storage URL
  ownerUid:  string   // 등록한 관리자 uid
  createdAt: unknown
}

// ── 공문 접수 ─────────────────────────────────────────
export interface IncomingDoc {
  id:           string
  docNo:        string        // 문서번호
  title:        string        // 제목
  sender:       string        // 발신기관
  receivedAt:   string        // 수신일자 (YYYY-MM-DD)
  dueDate?:     string        // 처리기한 (YYYY-MM-DD)
  hasDueDate:   boolean       // 처리기한 여부
  pdfUrl?:      string        // 첨부 PDF URL
  pdfName?:     string        // PDF 파일명
  memo?:        string        // 비고

  // 결재선
  receiver:     Approver      // 접수자 (본인)
  approvers:    Approver[]    // 검토자 0~3명
  finalApprover: Approver     // 최종 결재자

  status:       ApprovalStatus
  authorUid:    string
  createdAt:    unknown
  updatedAt?:   unknown
  approvedAt?:  string
  rejectedAt?:  string
}

// ── 결재선 관리 ───────────────────────────────────────
export interface ApprovalLine {
  id:        string
  name:      string           // 결재선 이름 (예: 일반결재)
  approvers: {
    uid:  string
    name: string
    role: string
  }[]
  finalApprover: {
    uid:  string
    name: string
    role: string
  }
  ownerUid:  string
  createdAt: unknown
}
