# ForgeTrack — Calendar UX Revamp & Navigation Architecture
## Research, Findings, and Recommendations

**Date:** 30 April 2026
**Scope:** Mark Attendance flow only. Other routes unaffected.
**Status:** Research document. No prompt — synthesis for planning.

---

## 1. What We're Trying to Do

Two things, simultaneously:

1. **Replace the linear "date picker → roster" flow with a calendar-centric Sessions Hub** — modeled on the AdminSchool reference (purple/dark events calendar) but rendered through our existing dark cosmic aesthetic, not purple.
2. **Add proper front/back navigation** — breadcrumbs, browser history that actually works, deep links that survive a refresh, state preservation across back/forward.

Everything we already shipped on the marking view (tap-to-toggle rows, bulk actions, branch chips, sticky save bar) stays. We're changing the *entry point* and the *navigation skeleton*, not the marking interaction itself.

---

## 2. Reference Image Analysis (AdminSchool Dashboard)

What the reference does well, decoupled from its color choices:

### Layout anatomy

| Region | Content | Purpose |
|---|---|---|
| Left rail (260px) | Sidebar nav with grouped sections, profile card at top | Persistent app navigation |
| Top bar | Page title, month label with prev/next chevrons, search, notifications, language, primary CTA | Page-scoped controls |
| Center hero (~60% width) | Monthly calendar grid, Mon→Sun, 5–6 rows of large day cells | The information surface |
| Right panel (~280px) | Vertical event list, each card showing date, title, time, price, tickets, 3-dot menu | Detail context without leaving the page |

### Day cell anatomy in the reference

- Empty day: just the date number, muted text on `--bg-surface-inset`
- Day with event: solid colored fill (pink, purple) — the cell *is* the event
- Day with mini-content: avatars, "Franklin, 2+" pill, dollar amount, dot indicators
- Today: not visually distinguished in the reference (this is a gap — we need to fix it for ForgeTrack)
- Selected: not shown (no selection state visible)

### What translates to ForgeTrack

| Pattern | Translates? | Notes |
|---|---|---|
| Calendar as primary surface | ✅ | The whole point of the revamp |
| Side panel with vertical event list | ✅ | Becomes "Recent / Upcoming Sessions" for ForgeTrack |
| Month nav with chevrons | ✅ | Standard pattern |
| Search bar in top region | ✅ | Already partially exists |
| Primary CTA top-right ("+ New Teachers") | ✅ | Becomes "+ New Session" |
| Solid colored fills for events | ⚠️ Partial | We have *semantic* color (green/red/yellow attendance). Solid pink/purple doesn't carry meaning for our domain. Use tinted backgrounds + colored left borders instead. |
| Avatars / participant chips inside cells | ❌ | Cell is too small at our density. Use a numeric ratio "32/36" instead. |
| Dollar amounts inside cells | ❌ N/A | We don't have prices. |

### What we explicitly drop from the reference

- The purple/pink color identity → keep our `--bg-canvas` + cosmic glow + `--accent-glow` indigo
- "ENGLISH" language toggle → not needed
- Notification bell with red dots → not needed for ForgeTrack
- Solid colored cell fills → replaced with semantic status tinting

---

## 3. Current State Analysis (Image 2)

What's already working and should not be touched:

- **Sidebar nav** — clean, role-aware, design system-compliant
- **Top bar with breadcrumbs** ("Activity / Mark Attendance") — has the right structure but is decorative only; not interactive yet
- **Search bar** — placeholder only, no implementation behind it
- **User avatar + name top-right** — standard pattern, working
- **Roster card** — the actual marking surface is solid: tap-to-toggle, color-coded left border, branch pills, "All Present" / "All Absent" bulk actions, "Present: 5/36" counter, primary save button bottom-right
- **Color treatment** — green (`--success-fg`) for present, red (`--danger-fg`) for absent, both as 3px left border + tinted row background. This is exactly per the design system.

What's broken in the current state:

| Issue | Why it matters |
|---|---|
| Date picker as the entry point | Reduces a multi-month bootcamp to a single-day input. Mentor can't see the schedule shape. |
| No calendar surface | Empty space in the middle of the screen. No overview of which days have sessions. |
| Breadcrumb is decorative, not functional | Clicking "Activity" doesn't navigate anywhere. Forces the user to use the sidebar to escape. |
| No back button | Once you're in the marking view, the only way out is the sidebar or browser back. |
| Deep linking unclear | If someone bookmarks `/attendance`, do they get the calendar or the last session they were on? Currently ambiguous. |
| Browser back behavior unknown | Likely broken — bulk action button clicks may not push history, modal opens/closes may not be reversible. |

---

## 4. Calendar UX Research — Key Findings

Sources: Eleken's calendar UI roundup, Page Flows on calendar UX, UI Patterns event-calendar pattern, Muzli inspiration roundup, UX Patterns dev calendar pattern, NN/g date-input research, react-big-calendar docs.

### 4.1 The single most important finding (Muzli, 2026)

> "Mobile calendar design typically favors agenda view (chronological list) over grid view as the primary mode — grids become too small to be actionable below 360px width."

This is the biggest constraint on our design. ForgeTrack is mobile-mandatory (mentor walking around a classroom marking attendance). Below ~360px, a 7-column grid becomes unusable — cells are 40px wide, can't hold meaningful content, can't be tapped accurately.

**Implication:** we need two equivalent views, not one — a calendar for desktop/tablet, an agenda for mobile. The user can toggle, but the default is responsive.

### 4.2 Calendar cells should "show what it means for the business" (Eleken)

> "Don't just show the date — show what it means for the business. Each cell becomes a data-rich component."

For ForgeTrack, "what it means for the business" = the attendance signal. So a day cell should communicate, at a glance:

1. Is there a session? (binary)
2. If yes, what's the attendance? (color signal + ratio)
3. Is it today / past / future? (temporal context)
4. Is anything interesting about it? (e.g., "imported from CSV", "no attendance marked yet")

### 4.3 Cell overflow: 2–3 events with "+N more" (Muzli)

We don't have multi-event days — ForgeTrack has at most one session per date by schema constraint (`UNIQUE(sessions.date)`). This eliminates the most common calendar UX pain point. Lucky.

### 4.4 Color is essential but must be backed by pattern/icon (Muzli, NN/g)

> "Color coding by category is essential — but must be backed by pattern or icon differentiation for color-blind users."

Our existing semantic colors (green/red/yellow) align with this. We add a small status icon (✓ / ✗ / circle) in the cell to back the color.

### 4.5 Empty calendars need designed empty states (Page Flows)

> "Research shows blank states make users wonder if the system works right."

For ForgeTrack, an empty calendar (no sessions in the visible month) is common — especially in early bootcamp months or future months. The empty state should show the bootcamp's expected schedule shape (e.g., "Sessions typically run Wed–Thu") and a "+ New Session" CTA.

### 4.6 Click-to-create on empty cells (Asana, Cal.com)

> "Calendar interfaces should let users finish common tasks with minimal clicks."

Click an empty (allowed) day → opens the Create Session modal pre-filled with that date. This collapses two interactions (click "+ New Session" → pick date) into one.

### 4.7 Hierarchy: separate primary values from supporting context (UX Patterns)

For our day cell, "primary value" = the date number + the attendance signal. Supporting context (topic name, ratio) goes second. Don't make all three feel equally important.

### 4.8 Density discipline (UX Patterns)

> "Do not use decorative chrome that competes with the data itself."

The reference image has a lot of chrome (solid fills, dollar amounts, avatar stacks). We strip that down. The cell should read first as "is there a session here, and how did attendance go?", not as a styled card.

---

## 5. Navigation UX Research — Key Findings

Sources: NN/g on breadcrumbs, React Router v6 docs, `useBackNavigation` GitHub, TanStack Router docs, Material Design navigation guidelines, Nielsen Norman SPA patterns.

### 5.1 Three navigation affordances, layered (NN/g)

For deep apps, users need three independent ways to navigate "up":

1. **Breadcrumb** — *where I am* in the hierarchy. Clickable.
2. **Back button** (in-page, not browser) — *where I came from*. Smarter than browser back when context matters.
3. **Browser back/forward** — *what state I was in last*. Must work for accessibility and trust.

These are not redundant. Each answers a different mental question. ForgeTrack currently has none of them functional.

### 5.2 URL is state (TanStack Router thesis, also React Router v6 best practice)

Anything the user can change about the view should be in the URL:

- Current month → `?month=2026-04`
- View mode (calendar/list/agenda) → `?view=calendar`
- Search query → `?q=workshop`
- Active branch filter → `?branch=cs`
- Selected session → path segment, e.g., `/attendance/2026-04-30`

Why: refresh works, back/forward works, bookmarking works, sharing works, and the implementation gets simpler because there's one source of truth for state instead of two (URL + React state).

### 5.3 Modals as routes vs modals as state (useBackNavigation, React Router docs)

Two patterns:

| Pattern | When to use | Browser back behavior |
|---|---|---|
| Modal as state (`useState`) | Quick, ephemeral modals (confirms, alerts) | Doesn't push history. Browser back closes the page, not the modal. |
| Modal as route (e.g., `/attendance/new`) | Modals that contain meaningful work (Create Session) | Pushes history. Browser back closes the modal. Bookmarkable. |

For ForgeTrack:

- Create Session modal → **route-based** (`/attendance/new`). It's meaningful work, deserves a URL, deserves a working back button.
- Delete confirmation → **state-based**. Ephemeral, no URL needed.
- "Mark all absent" confirmation → **state-based**. Same.

### 5.4 Back button should be context-aware, not history-aware (useBackNavigation)

> "When you click the X, you want to close the entire modal and go back to where you opened it from, regardless of where you navigated to since opening it."

Plain `window.history.back()` breaks when the user has navigated within a flow (e.g., opened the marking view, then changed branches via filter chip → both pushed history → "back" goes to wrong place).

The pattern: when entering a sub-route, store the originating URL in `location.state`. The "back" button reads from that state, not from `history.back()`. This is the pattern we'll use for ForgeTrack's marking view back button.

### 5.5 Breadcrumb truncation (NN/g)

For ForgeTrack our deepest breadcrumb is 3 levels:

`Activity / Mark Attendance / Apr 30, 2026`

Three levels never needs truncation — render in full at all viewport widths. The middle item is the only one that varies.

### 5.6 State preservation across back/forward (NN/g, MDN)

Specific things that should survive back/forward:

- Calendar's currently visible month
- Active view mode (calendar vs list vs agenda)
- Search query
- Active branch filter
- Scroll position within the calendar (if the user scrolled)
- Within marking view: which students were toggled (this is in DB after save, before save it's local state — accept that unsaved changes are lost on navigation away, but warn the user with `beforeunload` confirmation)

---

## 6. Synthesis: ForgeTrack Calendar Design

### 6.1 Overall page anatomy (desktop, ≥1024px)

```
┌─ Sidebar 260px ─┬─ Main content area (cosmic glow at top) ──────────────────────────┐
│                 │                                                                    │
│ ForgeTrack logo │ Activity ▸ Mark Attendance                          [N] Nischay BK│
│ Welcome, Nischay│                                                                    │
│ Dashboard       │ Mark Attendance                                                    │
│ ▶Mark Attendance│ Track sessions and student attendance across the bootcamp         │
│ Student History │                                                                    │
│ Materials       │ ┌─────────────────────────────────────────┬──────────────────────┐│
│ Assignments     │ │ ◀ April 2026 ▶          [Today]         │ RECENT SESSIONS      ││
│ Upload CSV      │ │ [Calendar | List | Agenda]   [+ New ▾] │                      ││
│                 │ │                                          │ ┌──────────────────┐ ││
│ Account         │ │ ┌──┬──┬──┬──┬──┬──┬──┐                  │ │ Apr 30 2026      │ ││
│ Logout          │ │ │M │T │W │T │F │S │S │                  │ │ Forge test 1     │ ││
│                 │ │ ├──┼──┼──┼──┼──┼──┼──┤                  │ │ 23/36 • 64% ◓    │ ││
│                 │ │ │  │  │ 1│ 2│ 3│ 4│ 5│                  │ └──────────────────┘ ││
│                 │ │ │  │  │  │  │  │  │  │                  │ ┌──────────────────┐ ││
│                 │ │ ├──┼──┼──┼──┼──┼──┼──┤                  │ │ Apr 24 2026      │ ││
│                 │ │ │ 6│ 7│ 8│ 9│10│11│12│                  │ │ ReAct Pattern    │ ││
│                 │ │ │  │  │ ✓│ ✓│  │  │  │                  │ │ 31/36 • 86% ●    │ ││
│                 │ │ ├──┼──┼──┼──┼──┼──┼──┤                  │ └──────────────────┘ ││
│                 │ │ ...                                      │ ...                  ││
│                 │ │                                          │                      ││
│                 │ └─────────────────────────────────────────┴──────────────────────┘│
└─────────────────┴────────────────────────────────────────────────────────────────────┘
```

**Three new regions:**

1. **Top bar inside main:** breadcrumbs + page title + subtitle (replaces the giant "Mark Attendance" hero in the current design — too much vertical real estate spent on a label)
2. **Calendar pane (left, ~70% of remaining width):** month nav + view toggle + primary CTA + the calendar grid
3. **Side panel (right, ~280px):** Recent Sessions list (scrollable). On mobile, this collapses below the calendar or is hidden entirely.

### 6.2 The day cell — the most important component

This is where most of the design thinking goes. The cell is small (~140px × 110px on desktop, smaller on tablet) but needs to communicate up to 4 things.

**Anatomy:**

```
┌──────────────────────────┐
│ 30                  [✓]  │   ← date number (top-left, large) + status icon (top-right)
│                          │
│ Forge test 1             │   ← topic name (truncated, 2 lines max)
│                          │
│ 23 / 36 • 64%            │   ← attendance ratio + percentage
└──────────────────────────┘
```

**State matrix:**

| State | Visual treatment |
|---|---|
| Empty (no session, past) | Date in `--text-tertiary`, otherwise empty. Background `--bg-surface-inset`. No interaction. |
| Empty (no session, future + allowed weekday) | Date in `--text-secondary`. On hover: `+` icon appears center, background brightens to `--bg-surface`. Click → opens Create Session modal pre-filled with date. |
| Empty (no session, weekend / not a class day) | Date in `--text-tertiary`, slightly faded. Not clickable. |
| Has session, marked, ≥75% attendance | 3px left border `--success-fg`, background `rgba(16,185,129,0.08)`, status icon ✓ in `--success-fg` |
| Has session, marked, 60–74% attendance | 3px left border `--warning-fg`, background `rgba(245,158,11,0.08)`, status icon ◓ in `--warning-fg` |
| Has session, marked, <60% attendance | 3px left border `--danger-fg`, background `rgba(244,63,94,0.08)`, status icon ✗ in `--danger-fg` |
| Has session, not yet marked | 3px left border `--accent-glow`, background `--bg-surface`, status icon ○ in `--accent-glow`. "Not marked yet" label in `--text-tertiary`. |
| Today | Add a 1px outer ring in `--accent-glow` to whatever the above state is. |
| Selected (after click on detail panel) | Add `box-shadow: var(--shadow-focus)` |

**Critical decision: solid color fill (reference) vs left-border tint (design system).**

The reference uses solid pink/purple fills. We can't, because:

1. Our color is *semantic* — green/red/yellow mean things. A solid red cell would scream "BAD" and dominate the visual hierarchy.
2. Our design system already uses left-border tinting for status (per §8.8 of the design system).
3. Solid fills make the topic name unreadable on the cell.

So: 3px colored left border + 8% opacity colored background + status icon in corner. Same color signal, lower visual weight, readable.

### 6.3 Side panel — Recent Sessions

```
RECENT SESSIONS                      [View all ↗]
─────────────────────────────────────
┌──────────────────────────────────┐
│ APR 30 • TUE                     │
│ Forge test 1                     │
│ ━━━━━━━━━━━━━ 64% • 23/36       │  ← progress bar tinted by status color
└──────────────────────────────────┘
┌──────────────────────────────────┐
│ APR 24 • THU                     │
│ ReAct Pattern Implementation     │
│ ━━━━━━━━━━━━━━━━━━ 86% • 31/36   │
└──────────────────────────────────┘
... (last 8 sessions)
```

- Cards are clickable → routes to that session's marking view
- "View all" link → switches the main view to List mode
- Hover state: `--bg-surface-raised`
- Empty state: "No sessions yet" + "+ Create your first session" CTA
- On viewport <1024px: side panel collapses below calendar
- On viewport <768px: side panel is hidden entirely (the calendar/agenda already shows recent stuff)

### 6.4 Three view modes

Per the responsive research finding (§4.1), we offer:

| View | When | What it looks like |
|---|---|---|
| **Calendar** | Default on ≥1024px | Monthly grid as described above |
| **List** | User toggle | Sortable table: date, topic, type, present, absent, % |
| **Agenda** | Default on <768px (mobile) | Vertical list grouped by week: "This Week", "Last Week", "April Week 3", etc. Each item is a session card. |

The toggle is a 3-way segmented control: `[Calendar] [List] [Agenda]`. The active view is in the URL (`?view=calendar`).

### 6.5 Empty calendar handling

If the user navigates to a month with zero sessions:

```
              [empty calendar grid still renders]

         Plus, overlaid in the center:
         ┌────────────────────────────────────┐
         │      [Calendar icon, large]        │
         │                                    │
         │    No sessions in April 2026       │
         │                                    │
         │  Sessions typically run Wed & Thu  │
         │                                    │
         │       [+ New Session]              │
         └────────────────────────────────────┘
```

The grid stays visible behind the message — establishes that "the system is working, just no data here" rather than a broken-looking blank page.

### 6.6 Mobile (agenda) view

On viewports below 768px, the calendar grid is unusable (cells too small). Default to agenda:

```
┌─ Agenda View ────────────────────┐
│ Activity ▸ Mark Attendance       │
│ Mark Attendance                  │
│                                  │
│ ◀ April 2026 ▶        [+ New]   │
│                                  │
│ THIS WEEK                        │
│ ┌────────────────────────────┐  │
│ │ Tue 30 Apr  ✓ 64%          │  │
│ │ Forge test 1 • 2hr • online│  │
│ └────────────────────────────┘  │
│                                  │
│ LAST WEEK                        │
│ ┌────────────────────────────┐  │
│ │ Thu 24 Apr  ✓ 86%          │  │
│ │ ReAct Pattern              │  │
│ └────────────────────────────┘  │
│ ...                              │
└──────────────────────────────────┘
```

Group sessions by week, show full session card per day, swipe to switch month (touch gesture), tap card → marking view.

---

## 7. Synthesis: Navigation Architecture

### 7.1 Route map

| Route | Component | Purpose |
|---|---|---|
| `/attendance` | `<SessionsHub />` | Calendar default. Reads `?month`, `?view`, `?q`, `?branch` from URL. |
| `/attendance/new` | `<CreateSessionModal />` overlaying `<SessionsHub />` | Modal as route. URL preserves the underlying calendar state via `location.state.from`. |
| `/attendance/new?date=2026-04-30` | Same | Pre-fills the date when entered via cell click. |
| `/attendance/:date` | `<MarkingView />` where `:date` = `YYYY-MM-DD` | Route to a specific session by date (not session UUID — date is unique and human-readable). |
| `/attendance/:date/edit` | Same view in edit mode | Future enhancement; not P0. |

**Why date-based routes over UUID-based?**

- Human-readable: `/attendance/2026-04-30` tells you what it is. `/attendance/9d8a-2f7c-...` doesn't.
- Stable: a session UUID could change in dev resets; a date is the actual primary key in the user's mental model.
- Bookmarkable: "Hey, look at the attendance for the April 24th session" is a real conversation, "look at session 9d8a-..." is not.
- The schema already enforces `UNIQUE(sessions.date)`, so date-based addressing is sound.

Risk: if the schema ever loosens that constraint (multiple sessions per day), we'd need to migrate URLs. Acceptable risk; the constraint is core to the bootcamp model.

### 7.2 Breadcrumb structure

Three positions, all clickable except the last:

| On route | Breadcrumb |
|---|---|
| `/attendance` | `Activity / Mark Attendance` |
| `/attendance/new` | `Activity / Mark Attendance / New Session` |
| `/attendance/2026-04-30` | `Activity / Mark Attendance / Apr 30, 2026 — Forge test 1` |

Breadcrumb is rendered in the top bar of the main content area (above the page title), in `text-caption` size with `--text-secondary` for non-current crumbs and `--text-primary` for the current. Separator is `/` in `--text-tertiary`.

Implementation: route config carries a `handle.crumb` function (per React Router v6 pattern from research). `<Breadcrumbs />` reads `useMatches()` and renders.

### 7.3 In-page back button

On marking view (`/attendance/:date`), top-left:

`[← Back to Calendar]`

Uses the `useBackNavigation` pattern: when the user clicks a day cell, we push `state: { from: '/attendance?month=2026-04&view=calendar' }`. The marking view's back button reads `location.state.from` and navigates there. Falls back to `/attendance` if state is missing (deep-linked entry).

This means: enter from calendar → back returns to that month, that view, that filter. Enter from a deep link or refresh → back returns to default calendar.

### 7.4 URL state contract

Source of truth for view state:

```
/attendance?month=2026-04&view=calendar&q=workshop&branch=cs
```

| Param | Type | Default | Persisted across nav |
|---|---|---|---|
| `month` | `YYYY-MM` | current month | yes |
| `view` | `calendar` \| `list` \| `agenda` | viewport-responsive | yes |
| `q` | string | empty | yes |
| `branch` | `cs` \| `ai` \| `is` \| `all` | `all` | yes |

Implementation: `useSearchParams` from React Router. Components read params, write through `setSearchParams({ ..., view: 'list' })`. No `useState` for any of these — the URL *is* the state.

### 7.5 Browser back/forward expectations

After this revamp, every one of these must work as the user expects:

- Click day cell → click back → returns to calendar with same month/filter
- Change month → click back → returns to previous month (history captures month changes)
- Switch view (calendar→list) → click back → returns to calendar view
- Apply branch filter → click back → filter cleared
- Open Create Session modal → click back → modal closes
- Save attendance, redirected to calendar → click back → does NOT return to marking view (post-save redirect uses `replace`, not `push`)

The last one is subtle but important: after a successful save we *replace* the current history entry rather than push, so the back button skips over the marking view. Otherwise the user pressing back lands on a stale roster they already saved, which is confusing.

### 7.6 Unsaved changes guard

On the marking view, if the user has unsaved toggles and tries to navigate away (back button, breadcrumb click, sidebar nav, browser back, browser close):

```
┌────────────────────────────────────┐
│ Unsaved changes                    │
│                                    │
│ You've changed 8 students'         │
│ attendance. Save before leaving?   │
│                                    │
│       [Discard]  [Save & exit]     │
└────────────────────────────────────┘
```

Use React Router's `useBlocker` for in-app navigation, `beforeunload` event for browser-level navigation. Modal is state-based (ephemeral).

---

## 8. Component Inventory — What's New

| Component | Complexity | Reuses |
|---|---|---|
| `<Breadcrumbs />` | Low | uses `useMatches`, route handle pattern |
| `<MonthNav />` | Low | chevron buttons + label, uses URL `?month` |
| `<ViewToggle />` | Low | 3-way segmented control, uses URL `?view` |
| `<CalendarGrid />` | High | The hero. 7-col grid, day cells, today highlight, hover affordances |
| `<DayCell />` | High | All 8 visual states from §6.2. Click handlers vary by state. |
| `<AgendaView />` | Medium | Mobile fallback. Groups sessions by week. |
| `<SessionsListView />` | Medium | Sortable table. Reuses table styles from design system §8.6. |
| `<RecentSessionsPanel />` | Low | Vertical list, mini cards. |
| `<EmptyMonthState />` | Low | Overlay on empty calendar. |
| `<UnsavedChangesGuard />` | Medium | Wraps marking view, hooks `useBlocker` + `beforeunload`. |
| `<BackButton />` | Low | Uses `location.state.from`, falls back to `/attendance`. |

Components that *don't* change (already shipped):

- Sidebar nav
- User avatar/name top-right
- `<MarkingView />` itself — the roster, tap-to-toggle, bulk actions, save bar
- `<CreateSessionModal />` — fields stay, but it's now route-driven
- All status pills, color tokens, typography

---

## 9. Mobile Strategy

The single biggest UX risk in this revamp is breaking the mobile flow.

### Breakpoints

| Width | View | Side panel | Sidebar |
|---|---|---|---|
| ≥1280px | Calendar (default) | Visible (280px) | Expanded (260px) |
| 1024–1279px | Calendar | Visible (240px) | Expanded |
| 768–1023px | Calendar | Hidden | Collapsed (icons only, 72px) |
| 375–767px | Agenda | Hidden | Drawer (off-canvas) |
| <375px | Agenda | Hidden | Drawer | (rare; supported but not optimized)

### Mobile-specific decisions

- Default view auto-switches to agenda below 768px, but the URL still says `?view=calendar` if that's what the user picked. We resolve at render time: if `view=calendar` and viewport <768px, render agenda but show a toast "Switched to agenda view for mobile" with a "Back to calendar" link.
- Swipe gestures on agenda (left/right) → previous/next month.
- Tap a session card on agenda → marking view. The marking view itself is already mobile-tested per the previous prompt.
- "+ New Session" button is full-width sticky bottom on mobile, primary right-aligned on desktop.

---

## 10. Open Questions / Tradeoffs

### Q1. Should the side panel show "Recent" or "Upcoming" sessions?

**Recent** is more useful for the daily flow (review what happened, fix mistakes). **Upcoming** is more useful for planning. Argument for both as a tab toggle inside the panel: low cost, real value. **Recommend:** tab toggle, default to Recent.

### Q2. What weekday(s) are clickable for "Create Session"?

The bootcamp runs Wed/Thu offline. Should we soft-block other weekdays?

- **Soft-block (allow but warn):** click any future day → Create modal opens, but with a banner "Bootcamp typically runs Wed/Thu. Continue?"
- **Hard-block:** only Wed/Thu future days are clickable.
- **No block:** any future day is clickable, no warning.

**Recommend:** no block. The schema already accepts any date; sessions can run on weekends for makeup classes. Don't impose UI constraints the data model doesn't have.

### Q3. Sessions imported via CSV — how do they appear on the calendar?

Imported sessions have `marked_by = 'csv_import'` in the schema. Should the cell visually distinguish them from manually-marked sessions?

**Recommend:** subtle indicator only — a small "imported" badge in the cell when hovered, no change to the primary visual state. The user shouldn't have to care about provenance during normal use.

### Q4. Multi-month overview?

The reference is single-month. Some attendance tools offer a quarterly heatmap or full-program timeline. Should we?

**Recommend:** not in this revamp. Add later as a separate "Program Overview" route under the Dashboard. Don't bloat the Mark Attendance page.

### Q5. Keyboard navigation on calendar grid?

Arrow keys to move between cells, Enter to open, Esc to back? This is real accessibility work.

**Recommend:** yes, but ship without first. Add in a follow-up pass with a11y testing. Document the gap.

### Q6. What does the "search" in the top bar actually search?

Currently it's decorative. Options: sessions only, students only, both with grouped results.

**Recommend:** scope it to the current page. On Mark Attendance, search filters the calendar/list/agenda by topic and date. Don't make it a global search yet.

### Q7. Should the calendar show attendance trends across cells?

Like, sparkline footers, color-fade if attendance is dropping?

**Recommend:** no. Dashboard's job, not Mark Attendance's. Keep the calendar single-purpose.

---

## 11. Risk Register

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| Browser back breaks after modal+marking-view nav | High | High | Use `useBackNavigation` pattern; test all 6 back-button scenarios from §7.5 explicitly |
| Day cells too dense to read on tablet (768–1023px) | Medium | Medium | Provide a "compact" cell variant that drops the topic name; show only date + status icon + ratio |
| Empty calendar feels broken | Medium | Medium | The `<EmptyMonthState />` overlay (§6.5); don't hide the grid |
| Performance: rendering 35+ cells, each with a query | Medium | Medium | Single query per month: `SELECT * FROM sessions WHERE date BETWEEN month_start AND month_end`; same for attendance counts (one query, group by session_id) |
| URL params get out of sync with React state | High | High | Don't keep parallel state. URL is the source of truth. Components read `useSearchParams` directly. |
| Mobile viewport renders calendar grid (broken) | High | High | Hard switch to agenda below 768px regardless of `?view=calendar`; show toast |
| User loses unsaved roster changes via browser back | High | High | `useBlocker` + `beforeunload` confirmation modal |
| Date-based URLs break if multiple sessions per date are ever allowed | Low | High | Schema-level constraint enforces UNIQUE(date); flag in roadmap if anyone tries to remove it |
| Calendar cell hover affordance ("+") on touch devices doesn't make sense | High | Low | On touch devices, show the "+" persistently on future allowed days, instead of on hover |
| Color-coded cells fail for color-blind mentor | Medium | Medium | Status icon (✓/✗/◓/○) backs the color (per §4.4 research); ratio text gives a third channel |

---

## 12. What Stays Out of Scope

To be clear about what this revamp does **not** touch:

- The `attendance` table and its `UNIQUE(student_id, session_id)` constraint
- The `sessions` table and its `UNIQUE(date)` constraint
- The `<MarkingView />` component itself — the tap-to-toggle row interaction stays
- RLS policies
- The CSV import flow
- The Dashboard
- Student Portal routes
- Authentication
- Materials
- Student History

This is a navigation + entry-point revamp. The marking interaction is good. The data model is good. We are reshaping how the user finds and moves between sessions, not how they mark them.

---

## 13. Summary for the Next Step

When you're ready to write the prompt for Antigravity, the prompt should ask it to build:

1. New `<SessionsHub />` page with calendar as primary view, list and agenda as alternates, side panel with recent sessions
2. Functional breadcrumbs using React Router v6 `useMatches` pattern
3. URL-as-state contract per §7.4
4. In-page back button using `location.state.from` pattern per §7.3
5. Day cell component with all 8 states per §6.2
6. Empty month state per §6.5
7. Mobile auto-switch to agenda view below 768px
8. Unsaved changes guard on marking view
9. Replace post-save push with replace per §7.5

What it should leave alone:

- The marking view itself
- The sidebar
- Everything outside `/attendance/*`

What's open for you to decide (the questions in §10):

- Recent vs Upcoming (or tabbed both) in side panel
- Whether to soft-block non-Wed/Thu cells
- How to mark CSV-imported sessions visually
- Whether to ship keyboard nav v1 or v2
- Search scope

Once those are decided, the prompt itself is mostly mechanical — same structure as `PROMPT_fix_mark_attendance.md`, just longer.

---

**End of research document.** Save alongside the spec, design system, and skill files. Use as the planning input for the next Antigravity prompt.
