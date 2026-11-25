# Grafik relasi database

Dibuat otomatis dari `prisma/schema.prisma` (37 tabel). Jangan diedit tangan; jalankan `npx tsx scripts/gen-erd.ts` setelah mengubah skema.

Keterangan: `PK` primary key, `FK` foreign key, `UK` unique. Garis `||--o{` = satu ke banyak, `|o--o{` = satu ke banyak dengan induk opsional, `}o--o{` = banyak ke banyak.

## Ringkasan seluruh tabel (relasi saja)

```mermaid
erDiagram
  User |o--o{ User : "reviewedBy"
  User |o--o{ Project : "sandboxOwner"
  Project ||--o{ ProjectMember : "project"
  User ||--o{ ProjectMember : "user"
  Project ||--o{ Sprint : "project"
  Project ||--o{ Bug : "project"
  Bug }o--o{ Bug : "related"
  Module |o--o{ Bug : "module"
  User ||--o{ Bug : "reporter"
  User |o--o{ Bug : "assignee"
  User |o--o{ Bug : "reviewedBy"
  Sprint |o--o{ Bug : "sprint"
  Bug |o--o{ Bug : "duplicateOf"
  AgentRun |o--o{ Bug : "agentRun"
  Bug }o--o{ BugTag : "tags"
  Bug ||--o{ BugComment : "bug"
  User ||--o{ BugComment : "author"
  Bug ||--o{ BugAttachment : "bug"
  Bug ||--o{ BugAssignee : "bug"
  User ||--o{ BugAssignee : "user"
  Bug ||--o{ BugCoReporter : "bug"
  User ||--o{ BugCoReporter : "user"
  Bug ||--o{ BugCoReporter : "sourceBug"
  Project |o--o{ AuditLog : "project"
  User |o--o{ AuditLog : "actor"
  Project ||--o{ BusinessDoc : "project"
  BusinessDoc ||--o{ BusinessDocVersion : "doc"
  BusinessDocVersion ||--o{ BusinessDocChunk : "version"
  Project ||--o{ TestCase : "project"
  Module |o--o{ TestCase : "module"
  RequirementSection |o--o{ TestCase : "section"
  TestCase ||--o{ TestCaseVersion : "testCase"
  User |o--o{ TestCaseVersion : "createdBy"
  Project ||--o{ TestRun : "project"
  User ||--o{ TestRun : "createdBy"
  User |o--o{ TestRun : "closedBy"
  TestRun ||--o{ TestRunItem : "testRun"
  TestCase ||--o{ TestRunItem : "testCase"
  User |o--o{ TestRunItem : "executedBy"
  TestCaseVersion |o--o{ TestRunItem : "testCaseVersion"
  Bug |o--o{ TestRunItem : "rerunBug"
  User |o--o{ TestRunItem : "runningBy"
  TestRunItem ||--o{ TestRunAttempt : "item"
  TestCaseVersion |o--o{ TestRunAttempt : "testCaseVersion"
  User |o--o{ TestRunAttempt : "executedBy"
  AgentRun |o--o{ TestRunAttempt : "agentSession"
  Project ||--o{ Evidence : "project"
  TestRunAttempt |o--o{ Evidence : "attempt"
  TestRunItem ||--o{ TestRunItemBug : "item"
  Bug ||--o{ TestRunItemBug : "bug"
  TestRunAttempt |o--o{ TestRunItemBug : "attempt"
  Project ||--o{ ApiKey : "project"
  User ||--o{ ApiKey : "createdBy"
  Project ||--o{ AgentRun : "project"
  ApiKey |o--o{ AgentRun : "apiKey"
  TestRun |o--o{ AgentRun : "testRun"
  Project ||--o{ ChatThread : "project"
  User ||--o{ ChatThread : "user"
  Project ||--o{ ChatMessage : "project"
  ChatThread |o--o{ ChatMessage : "thread"
  User ||--o{ ChatMessage : "user"
  Project ||--o{ Module : "project"
  User ||--o{ Notification : "user"
  User ||--o{ NotificationPreference : "user"
  Project |o--o{ NotificationPreference : "project"
  Project ||--o{ ProjectResourceLink : "project"
  User |o--o{ ProjectResourceLink : "owner"
  BusinessDoc ||--o{ RequirementSection : "doc"
  Module |o--o{ RequirementSection : "module"
  Sprint |o--o{ RequirementSection : "sprint"
  Project ||--o{ StlcDoc : "project"
  Sprint |o--o{ StlcDoc : "sprint"
  Sprint ||--o{ SprintClosure : "sprint"
  Project ||--o{ PerformanceNote : "project"
  User ||--o{ OnboardingProgress : "user"
  Project ||--o{ SavedBugView : "project"
  User ||--o{ SavedBugView : "owner"
  Project ||--o{ BugTag : "project"
```

## Pengguna, project, dan akses

```mermaid
erDiagram
  User |o--o{ User : "reviewedBy"
  User |o--o{ Project : "sandboxOwner"
  Project ||--o{ ProjectMember : "project"
  User ||--o{ ProjectMember : "user"
  Project |o--o{ AuditLog : "project"
  User |o--o{ AuditLog : "actor"
  Project ||--o{ ApiKey : "project"
  User ||--o{ ApiKey : "createdBy"
  Project ||--o{ Module : "project"
  User ||--o{ Notification : "user"
  User ||--o{ NotificationPreference : "user"
  Project |o--o{ NotificationPreference : "project"
  Project ||--o{ ProjectResourceLink : "project"
  User |o--o{ ProjectResourceLink : "owner"
  User ||--o{ OnboardingProgress : "user"
  User {
    string id PK
    string email UK
    string name
    string image
    enum status
    boolean isAdmin
    datetime createdAt
    datetime updatedAt
    string reviewedById FK
    datetime reviewedAt
    string rejectReason
    string passwordHash
    int failedLogins
    datetime lockedUntil
    datetime focusUntil
    string notificationScope
  }
  Project {
    string id PK
    string key UK
    string name
    string description
    boolean isArchived
    boolean isTest
    boolean isSandbox
    string sandboxOwnerId FK
    datetime createdAt
    datetime updatedAt
    int bugSeq
    string[] dodItems
  }
  ProjectMember {
    string id PK
    string projectId FK
    string userId FK
    enum role
    datetime createdAt
    datetime updatedAt
  }
  Module {
    string id PK
    string projectId FK
    string name
    int sortOrder
    datetime archivedAt
    datetime createdAt
    datetime updatedAt
  }
  RolePermission {
    string id PK
    enum role
    string permission
    boolean enabled
    datetime createdAt
    datetime updatedAt
  }
  ApiKey {
    string id PK
    string projectId FK
    string name
    string keyHash UK
    string keyPrefix
    string[] scopes
    enum role
    datetime expiresAt
    string createdById FK
    enum preset
    datetime revokedAt
    datetime lastUsedAt
    datetime createdAt
    datetime updatedAt
  }
  ApiKeyRateLimit {
    string id PK
    string keyHash
    datetime windowSlot
    int callCount
  }
  ProjectResourceLink {
    string id PK
    string projectId FK
    enum kind
    enum audience
    string label
    string url
    enum visibility
    string ownerUserId FK
    datetime lastOkAt
    string lastOkByUserId
    enum lastProblem
    string lastProblemRole
    datetime lastProblemAt
    datetime createdAt
    datetime updatedAt
  }
  OnboardingProgress {
    string id PK
    string userId FK
    string guideRole
    string[] completedSteps
    string[] dismissedTours
    datetime updatedAt
  }
  AuditLog {
    string id PK
    string projectId FK
    string actorId FK
    string actorEmail
    string actorType
    string action
    string entityType
    string entityId
    json changes
    datetime createdAt
  }
  Notification {
    string id PK
    string userId FK
    string projectId
    string type
    string title
    string body
    string href
    string actorName
    string sessionId
    datetime heldUntil
    datetime readAt
    datetime createdAt
  }
  NotificationPreference {
    string id PK
    string userId FK
    string projectId FK
    string type
    enum mode
    datetime createdAt
    datetime updatedAt
  }
```

## Bug dan kolaborasi

```mermaid
erDiagram
  Bug }o--o{ Bug : "related"
  Sprint |o--o{ Bug : "sprint"
  Bug |o--o{ Bug : "duplicateOf"
  Bug }o--o{ BugTag : "tags"
  Bug ||--o{ BugComment : "bug"
  Bug ||--o{ BugAttachment : "bug"
  Bug ||--o{ BugAssignee : "bug"
  Bug ||--o{ BugCoReporter : "bug"
  Bug ||--o{ BugCoReporter : "sourceBug"
  Sprint ||--o{ SprintClosure : "sprint"
  Bug {
    string id PK
    string projectId FK
    string key UK
    int number
    string title
    string description
    string stepsToReproduce
    string expectedResult
    string actualResult
    string jamUrl
    string taskUrl
    string[] links
    enum severity
    enum priority
    enum status
    string environment
    string appVersion
    string buildNumber
    string browserDevice
    string component
    string moduleId FK
    string reporterId FK
    string assigneeId FK
    string reviewedById FK
    datetime reviewedAt
    int reopenCount
    string reopenReason
    string fixedInVersion
    string fixedInBuild
    datetime dueAt
    string sprintId FK
    datetime verifiedAt
    string verifiedInBuild
    string duplicateOfId FK
    string agentRunId FK
    datetime createdAt
    datetime updatedAt
  }
  BugComment {
    string id PK
    string bugId FK
    string authorId FK
    string body
    enum type
    datetime createdAt
    datetime updatedAt
  }
  BugAttachment {
    string id PK
    string bugId FK
    string fileName
    string storedName UK
    int fileSize
    string mimeType
    datetime uploadedAt
  }
  BugAssignee {
    string id PK
    string bugId FK
    string userId FK
    enum roleSlot
    datetime createdAt
  }
  BugCoReporter {
    string id PK
    string bugId FK
    string userId FK
    string sourceBugId FK
    datetime createdAt
  }
  BugTag {
    string id PK
    string projectId FK
    string name
    datetime createdAt
  }
  SavedBugView {
    string id PK
    string projectId FK
    string ownerId FK
    string name
    string query
    enum visibility
    datetime createdAt
  }
  Sprint {
    string id PK
    string projectId FK
    string name
    datetime startsAt
    datetime endsAt
    enum status
    datetime closedAt
    datetime createdAt
  }
  SprintClosure {
    string id PK
    string sprintId FK
    json checklist
    string exceptionReason
    string closedById
    datetime createdAt
  }
  PerformanceNote {
    string id PK
    string projectId FK
    string userId
    string periodType
    string periodKey
    string body
    string authorId
    datetime updatedAt
  }
```

## Test case dan test run

```mermaid
erDiagram
  TestCase ||--o{ TestCaseVersion : "testCase"
  TestRun ||--o{ TestRunItem : "testRun"
  TestCase ||--o{ TestRunItem : "testCase"
  TestCaseVersion |o--o{ TestRunItem : "testCaseVersion"
  TestRunItem ||--o{ TestRunAttempt : "item"
  TestCaseVersion |o--o{ TestRunAttempt : "testCaseVersion"
  AgentRun |o--o{ TestRunAttempt : "agentSession"
  TestRunAttempt |o--o{ Evidence : "attempt"
  TestRunItem ||--o{ TestRunItemBug : "item"
  TestRunAttempt |o--o{ TestRunItemBug : "attempt"
  TestRun |o--o{ AgentRun : "testRun"
  TestCase {
    string id PK
    string projectId FK
    string code
    string moduleArea
    string moduleId FK
    string title
    enum status
    enum priority
    string testType
    string targetRole
    string precondition
    string steps
    string expectedResult
    string referenceUrl
    boolean agentReady
    json testData
    datetime createdAt
    datetime updatedAt
    string sectionId FK
  }
  TestCaseVersion {
    string id PK
    string testCaseId FK
    int version
    string changelog
    json snapshot
    string createdById FK
    datetime createdAt
  }
  TestRun {
    string id PK
    string projectId FK
    string name
    string environment
    string buildVersion
    enum status
    string createdById FK
    datetime createdAt
    datetime updatedAt
    enum decision
    string decisionNote
    datetime closedAt
    string closedById FK
  }
  TestRunItem {
    string id PK
    string testRunId FK
    string testCaseId FK
    enum status
    string actualResult
    string notes
    string executedById FK
    datetime executedAt
    string skipReason
    string testCaseVersionId FK
    boolean needsRerun
    string rerunBuild
    string rerunBugId FK
    string runningByUserId FK
    string runningAgentName
    datetime runningSince
    datetime heartbeatAt
    datetime leaseExpiresAt
    int currentStep
    int totalSteps
  }
  TestRunAttempt {
    string id PK
    string itemId FK
    int seq
    enum result
    string actualResult
    int failedStep
    string notes
    string build
    string environment
    string evidenceUrl
    string testCaseVersionId FK
    string executedById FK
    boolean viaAgent
    string agentName
    string toolName
    string agentSessionId FK
    datetime createdAt
  }
  TestRunItemBug {
    string itemId FK
    string bugId FK
    string attemptId FK
    datetime createdAt
  }
  Evidence {
    string id PK
    string projectId FK
    string uploadedById
    string sessionId
    string fileName
    string storedName
    string mimeType
    int fileSize
    string attemptId FK
    datetime purgedAt
    datetime createdAt
  }
  AgentRun {
    string id PK
    string projectId FK
    string apiKeyId FK
    string agentName
    string modelName
    string runId
    enum status
    datetime createdAt
    string toolName
    string workdir
    string testRunId FK
    datetime startedAt
    datetime finishedAt
    json summary
  }
```

## Dokumen bisnis dan STLC

```mermaid
erDiagram
  BusinessDoc ||--o{ BusinessDocVersion : "doc"
  BusinessDocVersion ||--o{ BusinessDocChunk : "version"
  BusinessDoc ||--o{ RequirementSection : "doc"
  BusinessDoc {
    string id PK
    string projectId FK
    string title
    string slug
    string description
    datetime createdAt
    datetime updatedAt
  }
  BusinessDocVersion {
    string id PK
    string docId FK
    int versionNum
    string fileName
    string storedPath
    int fileSize
    string mimeType
    boolean isCurrent
    string uploadedById
    datetime uploadedAt
    enum status
    string changeNote
    string decidedById
    datetime decidedAt
    string rejectReason
  }
  BusinessDocChunk {
    string id PK
    string versionId FK
    int chunkIndex
    string content
    string tsv
  }
  RequirementSection {
    string id PK
    string docId FK
    string anchor
    string title
    string contentHash
    enum status
    string[] acceptanceCriteria
    string moduleId FK
    string sprintId FK
    datetime readyAt
    datetime devDoneAt
    string devDoneById
    datetime createdAt
    datetime updatedAt
  }
  StlcDoc {
    string id PK
    string projectId FK
    enum kind
    string title
    string releaseVersion
    string sprintId FK
    enum status
    json body
    json snapshot
    string createdById
    string approvedById
    datetime approvedAt
    string finalizedById
    datetime finalizedAt
    datetime createdAt
    datetime updatedAt
  }
```

## Chat

```mermaid
erDiagram
  ChatThread |o--o{ ChatMessage : "thread"
  ChatThread {
    string id PK
    string projectId FK
    string userId FK
    string title
    datetime createdAt
    datetime updatedAt
  }
  ChatMessage {
    string id PK
    string projectId FK
    string threadId FK
    string userId FK
    enum role
    string content
    json citations
    json tokenUsage
    datetime createdAt
  }
```
