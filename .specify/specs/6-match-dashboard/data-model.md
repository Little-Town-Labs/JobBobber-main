# Data Model — Feature 6: Match Dashboard

## No Schema Changes Required

Feature 6 builds entirely on existing Prisma models from Features 1-5. No new tables, columns, or migrations needed.

## Existing Models Used

### Match (from Feature 5)

- `id`, `conversationId`, `jobPostingId`, `seekerId`, `employerId`
- `confidenceScore` (STRONG | GOOD | POTENTIAL)
- `matchSummary` (text)
- `seekerStatus`, `employerStatus` (PENDING | ACCEPTED | DECLINED | EXPIRED)
- `seekerContactInfo` (Json, populated on mutual accept)
- `seekerAvailability` (Json)
- `createdAt`, `updatedAt`

### SeekerSettings (from Feature 1)

- `notifPrefs` (Json) — stores notification opt-in/out preferences
- Used for: FR-11 (notification preferences)

### JobSettings (from Feature 1)

- No notification prefs field currently — employer notification prefs stored in `SeekerSettings.notifPrefs` equivalent on employer side or via a new `notifPrefs` column on Employer model.

## Application-Level Types (New)

### NotificationPreferences

```typescript
interface NotificationPreferences {
  matchCreated: boolean // default: true
  mutualAccept: boolean // default: true
}
```

### MatchFilterParams

```typescript
interface MatchFilterParams {
  status?: "PENDING" | "ACCEPTED" | "DECLINED" // FR-3
  sort?: "confidence" | "newest" // FR-4
  cursor?: string // FR-12
  limit?: number // default 20
}
```

### MatchStatusCounts

```typescript
interface MatchStatusCounts {
  all: number
  pending: number
  accepted: number
  declined: number
}
```

## Migration Note

If employer notification preferences are needed (FR-11), add a `notifPrefs Json @default("{}")` column to the `Employer` model. This is a minor, non-breaking migration.
