# 본부 관리 시스템 — 설치 및 배포 가이드

## 파일 구조
```
hq-system/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # 루트 레이아웃
│   │   ├── globals.css         # 전역 스타일
│   │   ├── page.tsx            # 루트 (로그인 리다이렉트)
│   │   ├── login/page.tsx      # 로그인 페이지
│   │   ├── dashboard/page.tsx  # 대시보드
│   │   ├── businesses/
│   │   │   ├── page.tsx        # 사업장 목록
│   │   │   └── [id]/page.tsx   # 사업장 상세 (기본정보 + 전달/지시)
│   │   ├── compose/page.tsx    # 전달/지시 작성 (전체 발송 포함)
│   │   ├── messages/[id]/page.tsx  # 메시지 상세 (본부용)
│   │   └── admin/page.tsx      # 멤버 관리 (본부장 전용)
│   ├── components/
│   │   ├── AppShell.tsx        # 사이드바 + 레이아웃
│   │   └── BusinessForm.tsx    # 사업장 추가/수정 모달
│   ├── lib/
│   │   ├── firebase.ts         # Firebase 초기화
│   │   ├── auth-context.tsx    # 로그인 상태 관리
│   │   └── db.ts               # Firestore 데이터 접근
│   └── types/index.ts          # TypeScript 타입 정의
├── firestore.rules             # Firestore 보안 규칙
├── .env.local.example          # 환경변수 템플릿
└── package.json
```

---

## 1단계: Firebase 프로젝트 만들기

1. https://console.firebase.google.com 접속
2. **프로젝트 추가** 클릭 → 이름 입력 (예: `hq-management`)
3. Google Analytics는 선택사항 (건너뛰어도 됨)

### 1-1. Authentication 설정
1. 좌측 메뉴 **Authentication** → **시작하기**
2. **이메일/비밀번호** 선택 → **사용 설정** 체크 → 저장

### 1-2. Firestore 설정
1. 좌측 메뉴 **Firestore Database** → **데이터베이스 만들기**
2. 시작 모드: **테스트 모드** 선택 (나중에 규칙 적용)
3. 리전: **asia-northeast3 (Seoul)** 선택

### 1-3. 웹 앱 추가 및 설정 값 복사
1. 프로젝트 설정(⚙️) → **일반** 탭 → 하단 **내 앱** → `</>` 클릭
2. 앱 닉네임 입력 → **앱 등록**
3. `firebaseConfig` 값 복사해두기 (다음 단계에서 사용)

---

## 2단계: 코드 설치

```bash
# Node.js 18 이상 필요 (https://nodejs.org)

cd hq-system
npm install

# 환경변수 파일 생성
cp .env.local.example .env.local
```

`.env.local` 파일을 열어 Firebase 콘솔에서 복사한 값 입력:
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=hq-management.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=hq-management
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=hq-management.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

---

## 3단계: 로컬 테스트

```bash
npm run dev
# http://localhost:3000 에서 확인
```

---

## 4단계: Firestore 보안 규칙 적용

1. Firebase 콘솔 → **Firestore Database** → **규칙** 탭
2. `firestore.rules` 파일 내용을 전체 복사해서 붙여넣기
3. **게시** 클릭

---

## 5단계: Vercel 배포 (무료)

```bash
# Vercel CLI 설치
npm install -g vercel

# 배포
vercel

# 질문에 답변:
# Set up and deploy? → Y
# Which scope? → 본인 계정 선택
# Link to existing project? → N
# Project name? → hq-management (원하는 이름)
# Directory? → . (현재 디렉토리)
```

배포 완료 후 환경변수 설정:
1. https://vercel.com → 프로젝트 선택
2. **Settings** → **Environment Variables**
3. `.env.local` 파일의 6개 변수를 하나씩 추가
4. **Redeploy** 클릭

✅ 완료! `https://[프로젝트명].vercel.app` 링크를 카카오톡으로 공유하면 됩니다.

---

## 6단계: 첫 번째 계정 만들기 (본부장)

배포된 사이트에서:
1. Firebase 콘솔 → Authentication → **사용자 추가**
2. 이메일/비밀번호 입력 → 사용자 추가
3. Firestore → **users** 컬렉션 → 문서 ID = 위에서 생성된 UID
4. 아래 필드 추가:
   ```
   uid:   "위의 UID"
   email: "입력한 이메일"
   name:  "본부장 이름"
   role:  "HQ_CHIEF"
   ```
5. 이후 멤버 추가는 시스템 내 **멤버 관리** 메뉴에서 가능

---

## 권한 구조

| 역할 | 메뉴 | 가능한 작업 |
|------|------|-------------|
| **본부장** (HQ_CHIEF) | 전체 | 사업장 추가/수정/삭제, 전달 발송, 멤버 관리 |
| **본부멤버** (HQ_MEMBER) | 전체 (멤버관리 제외) | 전달 발송, 전체 현황 조회 |
| **사업장대표** (BIZ_REP) | 내 사업장만 | 접수확인, 답변 작성 |

---

## 주요 기능

- ✅ 이메일/비밀번호 로그인
- ✅ 사업장 추가/수정/삭제 (주주명부, 임원정보 포함)
- ✅ 전달/지시 작성 — 특정 사업장 또는 **전체 동시 발송**
- ✅ 긴급/일반 중요도 구분
- ✅ 사업장별 접수확인 / 답변 기능
- ✅ 본부에서 사업장별 미접수 현황 실시간 확인
- ✅ 사이드바 미접수 배지 (숫자 알림)
- ✅ PC + 모바일 반응형
- ✅ 모든 기록 Firestore에 영구 저장

---

## 문의

설치 중 오류가 발생하면 오류 메시지와 함께 문의해주세요.
