# v08 visual / UX polish proposal

Scope: polish, not redesign. Light theme stays, Google-Workspace restraint stays. Everything below is a refinement of the system that already exists in `frontend/src/index.css` and the components.

> Method note: the Chrome extension was not connected in this session, so this audit is from source only (`frontend/src/**`), not from screenshots. Pixel claims are derived from the Tailwind classes and `calendar.css` in the code; they should hold, but eyeball the calendar items against the running app before committing to them.

Assumed context: Execute is going away; its calendar (tracked entries + planned intervals + Google events) merges into Plan, and "start timer" moves to a button above the task name in the detail panel. Nothing here polishes Execute; a few items are written so the merged Plan calendar lands well.

---

## Current state

**What the system is today**

- Palette (`index.css` `@theme`): a faithful Material-2 / Google set. Grays `#202124 / #5f6368 / #dadce0 / #f1f3f4 / #f8f9fa`, accent `#1a73e8` with `#e8f0fe` soft, danger/success/warning each with a soft tint. Task colors (`tree/colors.ts`) are the 11 Google Calendar event hues. This is a good foundation and nothing here changes it.
- Type: system stack (Segoe UI on Windows). Almost everything is `text-xs` (12px) or `text-sm` (14px); section labels are 12px uppercase `tracking-wide`; badges and a few captions are `text-[10px]`. Task title is `text-xl font-semibold`.
- Shape: `rounded` (4px) on buttons/inputs/rows, `rounded-lg` (8px) + `border border-border` + `shadow-xl` on every dialog and menu, `rounded-full` on badges and chips.
- Components: none shared. The dialog scaffold `fixed inset-0 z-50 … bg-black/50` + `w-96 rounded-lg border … p-4 shadow-xl` is copy-pasted in 20 files. Button styling is inlined ~38 times in 4-5 near-identical variants. Icons are unicode glyphs (`▸ ▾ + ⋮ ⚙ × ← →`).
- Calendar: react-big-calendar's default stylesheet with a light `calendar.css` override: stacked MON/date header (good), 11px gutter, whole `today` column tinted `accent-soft`, chips 6px radius / 12px / solid task color, past chips at 0.55 opacity.
- Motion: two `transition-colors` in the whole app (nav tabs, left-panel tabs). No dialog/menu enter animation, no chevron rotation, no `focus-visible` styling anywhere (inputs actually remove the outline and replace it with a 1px border color change).

**What works**

- Palette choices and the calendar day header already read as Google Calendar.
- Selection state in the tree (`bg-accent-soft text-accent`) is exactly right.
- Dense, information-first layout; nothing is oversized.
- Consistent 4px spacing scale; no rogue margins.

**What makes it feel "rusty"**

1. **Floating surfaces are heavy.** `shadow-xl` (Tailwind: 25px blur) plus a 1px border plus a 50% black scrim is the 2015 look. Google surfaces have no border and a tight two-layer shadow.
2. **Unicode glyphs as icons.** `▸ ▾ ⋮ ⚙ ×` render at inconsistent weights and optical sizes across fonts; `⚙` can render as an emoji on Windows. This is the single most visible "unfinished" cue.
3. **Everything is 12px.** Buttons, dialog body copy, menu items, and table cells all at `text-xs` reads cramped rather than dense. Google's dense UI is 13-14px with tight leading, not 12px.
4. **No motion or focus feedback.** Dialogs pop, chevrons flip, ghost buttons only change text color on hover, and keyboard focus is the browser default ring (or nothing).
5. **Duplicated chrome.** In Plan, the "Tasks / Recurrent tasks" tab strip sits directly above a "TASKS" header row that repeats the same word plus a `+`. In Evaluate, a second row of underline tabs sits under the first row of underline tabs.
6. **Loud emphasis in the wrong places.** The whole today column is blue-tinted; `done` is the only solid-fill badge (so finished tasks are the loudest rows); the drop target while dragging is a 2px ring around the entire calendar.
7. **A few off-palette hexes.** External Google events use Tailwind grays (`#e5e7eb / #374151 / #9ca3af`), the favicon uses Tailwind slate/green, `ColorDots` falls back to `#666`.

---

## Improvements

Format: **what** / why / effort (S = under an hour, M = a few hours, L = a day-plus) / files.

### (a) Foundational: tokens

**1. Add elevation and radius tokens; drop borders on floating surfaces.** — S · `index.css`, then every dialog/menu (see #9)
Add to `@theme`:
```
--shadow-1: 0 1px 2px rgba(60,64,67,.30), 0 1px 3px 1px rgba(60,64,67,.15);   /* menus, popovers */
--shadow-2: 0 1px 3px rgba(60,64,67,.30), 0 4px 8px 3px rgba(60,64,67,.15);   /* dialogs */
--radius-sm: 4px;  --radius-md: 8px;
--color-scrim: rgba(32,33,36,.40);
```
Replace every `shadow-xl` with `shadow-2` (dialogs) or `shadow-1` (ContextMenu, TaskPicker, TaskFilter dropdowns), remove `border border-border` from those surfaces, replace `bg-black/50` with `bg-scrim`. Why: this alone removes most of the "heavy" feel; the two-layer shadow is what makes Google surfaces look like paper instead of a card with a frame.

**2. Add the three missing color tokens.** — S · `index.css`, `StateBadge.tsx`, `eventColor.ts`, `favicon.ts`, `ColorDots.tsx`
- `--color-text-tertiary: #80868b` (Google's) for placeholders, "(current)", "(goal)", helper lines. Today those use `text-secondary`, same as section labels, so hierarchy flattens.
- `--color-border-subtle: #e8eaed` for hairlines *inside* a panel (table rows, interval list, tree header); keep `#dadce0` for panel dividers. Two border tones is what separates "sections" from "structure".
- `--color-warning-text: #b06000`. `StateBadge` currently sets `text-warning` (`#f9ab00`) on `bg-warning-soft`; that's roughly 1.9:1 contrast and reads as washed out. Use the amber text token for "Sprint backlog".
- While there: `EXTERNAL_EVENT_STYLE` → `bg: var(--color-surface-hover)`, `color: var(--color-text-primary)`, `border: 1px solid var(--color-border)`; favicon neutral → `#5f6368`, active → `#188038`; `ColorDots` fallback → `COLOR_HEX.gray`.

**3. Type scale: introduce a 13px UI size and an 11px caption size; retire `text-[10px]`.** — S · `index.css` + find/replace
```
--text-ui: 13px;   --text-ui--line-height: 20px;   /* rows, buttons, menu items, table cells */
--text-2xs: 11px;  --text-2xs--line-height: 16px;  /* caps labels, badges, gutter, captions */
```
Rules: tree rows, buttons, menu items, table body → `text-ui`. Dialog body and inputs → `text-sm` (14px). Meta lines → `text-xs`. Uppercase section labels and `StateBadge` → `text-2xs tracking-wider` (0.05em; at 11px the current `tracking-wide` 0.025em is too tight for caps). Nothing at 10px. Why: 12px-everywhere is why it feels cramped; 13px on 20px leading is the density Google Drive/Calendar actually use. Add `font-variant-numeric: tabular-nums` on the body so hours/percentages/timer digits align.

**4. Kill the `calc(100vh-49px)` magic number.** — S · `App.tsx`, `PlanView.tsx`, `EvaluateView.tsx` (`ExecuteView` goes away)
Give the nav an explicit `h-12` and make `<main>` `flex-1 min-h-0`; views become `h-full`. Right now nav height is derived from `py-3` + 14px text and can be 45-46px, so the hard-coded 49 either overflows or leaves a gap.

### (b) Component-level primitives

**5. `Button` component with four variants, one size.** — M · new `components/common/Button.tsx`, then replace ~38 inline strings
- Base: `inline-flex items-center gap-1.5 h-8 px-3 rounded-sm text-ui font-medium transition-colors duration-150 select-none disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2`
- `primary`: `bg-accent text-white hover:bg-accent-hover`
- `outlined`: `border border-border text-accent hover:bg-accent-soft` (Google's secondary action is blue text in a gray outline, not gray text)
- `ghost`: `text-text-secondary hover:bg-surface-hover hover:text-text-primary` — today Cancel buttons only change text color on hover, so they don't feel like buttons
- `danger`: `bg-danger text-white hover:bg-danger-hover`
- `icon` (square 32px, `rounded-full`, ghost hover) for `⋮ ⚙ + × ‹ ›`
Height goes from ~26px (`py-1.5 text-xs`) to 32px. In-panel small actions ("+ Add to calendar", "Discard") use a `size="sm"` at `h-7 px-2`.

**6. Inputs: one recipe, a real focus state, styled native controls.** — S · `index.css` (global rules) + the 9 `focus:border-accent` sites, `IntervalTimeFields.tsx`, `ExplainGapDialog.tsx`, `RecurrenceRuleFields.tsx`, `TaskDetailPanel.tsx` select
Global in `index.css`:
```
input:not([type=checkbox],[type=radio]), select, textarea {
  border-radius: var(--radius-sm); border: 1px solid var(--color-border);
  background: var(--color-surface); padding: 0 10px; height: 32px; font-size: 14px;
}
textarea { height: auto; padding: 6px 10px; }
:is(input, select, textarea):focus-visible { outline: none; border-color: var(--color-accent); box-shadow: 0 0 0 1px var(--color-accent); }
input[type=checkbox], input[type=radio] { accent-color: var(--color-accent); }
```
Why: four inputs (`IntervalTimeFields` dates/times, both `ExplainGapDialog` fields, the "Add parent" select) have no focus style at all and fall back to Chrome's ring; the rest have a 1px border color change which is nearly invisible. The 2px accent (1px border + 1px shadow) is the Google focus. Native checkboxes in `TaskFilter` and radios in `RecurrenceRuleFields` are unstyled; `accent-color` fixes them in one line.

**7. `StateBadge`: quieter, and `done` stops being the loudest.** — S · `StateBadge.tsx`
- `text-2xs font-medium px-1.5 h-[18px] inline-flex items-center rounded-full`
- `done`: `bg-surface-alt text-text-tertiary` with a 10px check glyph, instead of solid green with white text. A finished task should recede; today it's the only filled pill on screen.
- `sprint_backlog`: `bg-warning-soft text-warning-text` (see #2).
- Unify the "goal" tag in `StatsPanel.tsx` (currently `border … text-[10px]`, square) to the same badge shape in the neutral style.

**8. `Menu` (context menu + options menu): sizing, edge clamping, keyboard.** — S/M · `calendar/ContextMenu.tsx` (move to `common/`)
- `min-w-40 rounded-md py-1 shadow-1` (no border), items `h-8 px-3 text-ui`, danger item `text-danger hover:bg-danger-soft`.
- Clamp to viewport: after mount, if `x + width > innerWidth` flip left; if `y + height > innerHeight` flip up. Right-clicking a tree row near the bottom currently opens the menu partly off-screen.
- Escape closes; ArrowUp/Down + Enter move and select. Add `role="menu"` / `role="menuitem"`.
- 100ms fade-in (see #24).

**9. `Dialog` component; delete the 20 scaffolds.** — M (mechanical) · new `components/common/Dialog.tsx`; every file in `components/**/*Dialog*.tsx`, `*Modal*.tsx`, `AlertDialog`, `ConfirmDialog`, `ConfigDialog`, `GoogleEventDetailPanel`
- Surface: `w-[400px] max-w-[calc(100vw-32px)] rounded-md bg-surface p-6 shadow-2` (no border). Title `text-base font-medium text-text-primary mb-1`; optional subtitle `text-xs text-text-tertiary mb-4`; body `text-sm`; footer `mt-6 flex justify-end gap-2`.
- Behavior: `role="dialog" aria-modal`, Escape closes, scrim click closes for non-destructive dialogs (prop `dismissible`), initial focus on the first field or the primary button, focus returns to the opener. Enter animation per #24.
- `ConfirmDialog`/`AlertDialog`/`DeleteWithChildrenDialog`/`GroupDeleteDialog` become thin wrappers. Padding goes 16 → 24px, which is the difference between "popup" and "dialog".

**10. Replace unicode glyphs with a tiny inline SVG icon set.** — S/M · new `components/common/icons.tsx`; `TaskTreeNode`, `TaskTree`, `RecurrentTasksList`, `TaskDetailPanel`, `StatsPanel`, `TaskPicker`, `TaskFilter`, `ConfigButton`, `PlanCalendar`, `EvaluateView`
Eight 16px icons on a 24 grid, `stroke="currentColor" stroke-width="1.75"`: `ChevronRight`, `Plus`, `MoreVertical`, `Settings`, `Close`, `Check`, `ChevronLeft`, `DragHandle`. Every `▸/▾` becomes `<ChevronRight className={`transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`} />` — one glyph, rotated, animated. Judgment call: hand-rolled set (zero deps, ~60 lines) vs `lucide-react` (tree-shakeable, consistent, one more dependency). Recommend hand-rolled given only ~8 icons are needed.

### (c) Plan: tree + detail panel

**11. Merge the tab strip and the panel header.** — S · `PlanView.tsx`, `TaskTree.tsx`, `RecurrentTasksList.tsx`
Delete the "TASKS / +" header row inside each list. The tab strip becomes `h-10 px-2`: tabs on the left (`text-ui`, underline), a 28px icon `+` button pinned right whose action follows the active tab. Saves ~33px vertical and removes the doubled word. Empty-state copy ("No tasks yet…") should then reference the `+` in the strip.

**12. Tree row rhythm and affordances.** — S · `TaskTreeNode.tsx`, `RecurrentTasksList.tsx`
- Row: `h-7 rounded-sm px-1.5 gap-2 text-ui` (28px, same as today, but with 20px leading the text sits centered instead of floating).
- Indent: keep 16px/depth; draw a 1px `border-subtle` guide line at each depth (`absolute left-[calc(depth*16px+11px)] top-0 bottom-0`) so deep trees read as a tree. Optional; Google Drive doesn't, VS Code does. Judgment call.
- Cursor: `cursor-grab active:cursor-grabbing` instead of `cursor-pointer` (rows are draggable; nothing says so today). Show a `DragHandle` icon at the far left at `group-hover:opacity-100 opacity-0`.
- Hover actions: today `+` appears on hover; add a `⋮` next to it that opens the same context menu ("Mark as done", "Delete"). Right-click is currently the *only* way to reach those, which is undiscoverable.
- Reparent drop preview: `outline-2` → `ring-1 ring-accent bg-accent-soft/60` (the 2px outline draws outside the row and clips against neighbors).
- Selected + hovered: add `hover:bg-accent-soft` on the selected row so hover doesn't flicker it gray.

**13. Badge noise in the tree.** — S · `TaskTreeNode.tsx` · judgment call
Every row carries a pill; with `backlog` being the default state, the tree is a column of gray "Backlog" pills. Options: (a) hide the badge for `backlog` and `done` (done gets the check icon in `text-tertiary` instead); (b) keep badges but show only on hover/selected; (c) keep as is. Recommend (a). This is the change most likely to make the tree feel calm, and also the most likely to need your OK since you may scan by state.

**14. Detail panel: header action bar (lands the v08 "start timer" button too).** — M · `TaskDetailPanel.tsx`
Reorganize the top of the panel into three lines:
1. `StateBadge` + "derived from N sub-tasks" (as now), `⋮` icon button on the right.
2. Task name input, `text-xl font-medium` (600 → 500; semibold at 20px reads heavy in Segoe). Give it an editable affordance: `rounded-sm -mx-1.5 px-1.5 hover:bg-surface-alt focus:bg-surface-alt`.
3. Action row: `[▶ Start timer]` (primary when idle / `[■ Stop 00:12:34]` danger when this task is tracking) · `[Add to calendar]` outlined · `[+ Sub-task]` ghost. Save/Discard appear in this row when dirty, right-aligned.
This absorbs the current "Add child task" section (a whole labeled section for one button) and the "Sprint schedule" header button.

**15. Detail panel: section rhythm and labels.** — S · `TaskDetailPanel.tsx`
- Sections: uniform `space-y-6`; every label `text-2xs font-medium uppercase tracking-wider text-text-secondary mb-1.5`. Today it alternates `mt-4` / `mt-6` and `mt-1` / `mt-2`.
- Rename "Estimated time" → "On calendar" (the content is "2.5h currently on the calendar"; the label and the value disagree). Put the sub-task sum on the same line: `2.5h scheduled · 6h estimated (sum of sub-tasks)`.
- Parents / Requires chips: `h-6 pl-2.5 pr-1 gap-1 rounded-full bg-surface-alt text-xs`, close icon in a 16px round hit area. Replace the native "Add parent…" `<select>` with the same `TaskPicker` used for Requires so both pickers look alike.
- Interval list rows: `h-7 rounded-sm bg-surface-alt px-2 text-xs` with the date in `text-text-primary` and the time range in `text-text-secondary`, delete icon on hover only.
- Panel padding `p-6` → `p-5` (calendar gets the room; 20px still reads spacious next to 16px in the tree).

**16. Empty detail column.** — S · `PlanView.tsx` · judgment call
With nothing selected the middle column is 288px of "Select a task to see its details". Options: (a) collapse it to 0 with a 150ms width transition until a task is selected; (b) keep. After the Execute merge the calendar is the busiest surface, so (a) is worth it. If (b), at least make the placeholder an `EmptyState` (#27).

### (d) Calendar (the merged Plan calendar)

**17. Today: highlight the date, not the column.** — S · `calendar.css`, `CalendarDayHeader.tsx`
`.rbc-today { background: transparent }`. In `CalendarDayHeader`, when `isToday(date)`: day-name in `text-accent`, day-number in a 32px circle `bg-accent text-white rounded-full` (`font-weight: 500`). Google Calendar does exactly this; the tinted column fights with chip colors and makes today look like an off-range day.

**18. Grid geometry and default scroll.** — S · `calendar.css`, `PlanCalendar.tsx`, `EvaluateCalendar.tsx`
- `.rbc-timeslot-group { min-height: 48px }` (rbc default 40). At 40px a 30-minute chip is 20px tall and can't show a title; 48px is Google's hour height.
- `scrollToTime={new Date(0, 0, 0, 7)}` on both calendars. rbc scrolls to midnight by default, so the first paint is the empty early-morning rows.
- Gutter labels: `.rbc-time-gutter .rbc-label { position: relative; top: -8px; padding-right: 8px; }` so "09:00" sits on its hour line (Google) rather than below it. Hide the "00:00" label at the very top.
- Hairlines: `.rbc-timeslot-group` half-hour line → `border-subtle`; day columns and hour lines → `border`.
- Current-time line: keep 2px danger; add the 12px dot at the gutter edge: `.rbc-current-time-indicator::before { content:''; position:absolute; left:-6px; top:-5px; width:12px; height:12px; border-radius:50%; background:var(--color-danger) }`.

**19. Event chips.** — S/M · `calendar.css`, `eventColor.ts`, `PlanCalendar.tsx`
- Radius 6 → 4px; padding `2px 6px` → `2px 4px 2px 6px`; title `font-weight: 500`, 12px; `.rbc-event-label` (the time line) 11px `opacity: .85`.
- Hide the time label on chips shorter than 45 min: add `className: 'chip-short'` from `eventPropGetter` when `end - start < 45min`, and `.chip-short .rbc-event-label { display: none }`. Today short chips show only the time and lose the title.
- Text color by luminance: yellow (`#f6bf26`), sage (`#33b679`) and pink (`#e67c73`) chips with white text sit around 1.6-2.3:1. Add `chipTextColor(colors)` in `eventColor.ts` returning `--color-text-primary` when the primary hex's relative luminance is above ~0.45.
- Two-color chips: the 135° 50/50 hard split reads as a glitch. Alternative: solid primary fill with a 4px `border-left` (or right) in the secondary. Judgment call; the split is a deliberate feature, so keep if you like it and just soften to `linear-gradient(135deg, a 0 48%, transparent 48% 52%, b 52%)` so a 1px white seam separates the halves.
- Selected chip: `outline: 2px solid var(--color-text-primary)` → `box-shadow: 0 0 0 2px var(--color-surface), 0 0 0 4px var(--color-accent)` (a double ring that works on any chip color).
- Google events: on-palette per #2, plus `border-left: 3px solid var(--color-text-secondary)` so "external" is legible even when the chip is tiny.

**20. Planned vs tracked in the merged calendar.** — M · `PlanCalendar.tsx`, `eventColor.ts` · judgment call, decide before the merge
`ExecuteCalendar` renders tracked entries and future planned intervals with the *same* solid fill, so once they share a week you can't tell a 10:00 plan from a 10:00 tracked session except by whether it's in the past. Proposal:
- Planned interval: solid fill (as today; planning is the primary act on this view).
- Tracked entry: same hue at 18% over white (`color-mix(in srgb, <hex> 18%, white)`), `border-left: 3px solid <hex>`, text in `<hex>` darkened, drawn on top of the planned chip so overlap reads as "did what was planned".
- Live entry (end = null): the tracked style plus a 2px accent ring and a small pulsing dot before the title (`@keyframes` 1.2s, `prefers-reduced-motion` guard).
- Past planned chip with no tracked overlap: keep the 0.55 opacity fade.
The alternative (tracked solid, planned outlined) mirrors the Evaluate diff view; either is fine, pick one and use it in both views. Add a 3-item legend at the right of the toolbar (`▬ Planned · ▭ Tracked · ● Live`) in `text-2xs text-text-tertiary`.

**21. Calendar toolbar.** — S · `PlanCalendar.tsx`, `EvaluateView.tsx`
Left: two 32px round icon buttons `‹ ›` (Prev stays disabled on the current week in Plan, as now), a **Today** outlined button (currently there is no way back to this week except clicking Prev N times), then the week label promoted to `text-base font-medium text-text-primary` ("1 – 7 Sep 2026"; drop the "(current)" suffix since Today being disabled already says it). Right: the legend (#20). Move "Drag a task here to schedule it" out of the toolbar into the empty-week state (#27), it's noise once the week has chips.

**22. Drop target while dragging from the tree.** — S · `PlanCalendar.tsx`
`ring-2 ring-accent` around the whole grid → `bg-accent-soft/40` on the grid wrapper only (the drag-preview chip already shows the exact slot). Preview chip: `opacity .7` → `.85` with `shadow-1` so it looks lifted.

### (e) Evaluate

**23. One level of tabs, one segmented-control style.** — S/M · `EvaluateView.tsx`, new `components/common/SegmentedControl.tsx`
Two rows of identical underline tabs (Plan/Evaluate, then Calendar/Metrics/Excuses) is the hierarchy problem here. Make the sub-tabs a segmented control placed in the toolbar row (left, before the period nav), and use the *same* control for Planned/Real/Diff and Day/Week/Month: container `inline-flex h-8 p-0.5 rounded-sm border border-border`, segment `px-3 rounded-[3px] text-ui`, active `bg-accent-soft text-accent font-medium`. Today the active segment is a solid blue pill (`bg-accent text-white`) which is a primary-button look used for a toggle.

**24. Fill the height; align the numbers.** — S · `EvaluateView.tsx`, `StatsPanel.tsx`, `ExcusesPanel.tsx`
- Calendar area `h-[500px]` → `flex-1 min-h-0` (after the Execute merge this is the only other calendar and it should fill like Plan's).
- Tables: numeric columns `text-right tabular-nums`, header cells match alignment, rows `h-9 border-t border-subtle hover:bg-surface-alt`, first column `pl-2`, last `pr-2`. Table header `text-2xs tracking-wider`.
- Stat tiles: `rounded-md border border-border p-4`; label `text-xs text-text-secondary`; value `text-[22px] leading-7 font-medium tabular-nums`. Make "Executed %" the first tile (it's the number you actually check) and color it `text-success` at or above 80, `text-warning-text` 50-79, `text-danger` below 50. Judgment call: thresholds.
- Optional, restrained: a 64×4px progress track in the "%" column of the by-task table (`bg-surface-hover` track, `bg-accent` fill). It's the one place a tiny data-viz earns its place.

**25. Diff calendar legend and gap affordance.** — S · `EvaluateView.tsx`, `EvaluateCalendar.tsx`
Add the same legend as #20 plus "▭ Missed — click to explain" in Diff mode. Explainable gaps currently rely on `font-weight: 600` + an inset 1px shadow, which is subtle; add `cursor: pointer` (already) and a hover `background: color-mix(in srgb, <hex> 10%, white)`.

### (f) Motion, states, feedback

**26. Global transitions and focus ring.** — S · `index.css`
```
button, a, [role=button], [role=menuitem] { transition: background-color .15s, color .15s, border-color .15s, box-shadow .15s, opacity .15s; }
:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
@keyframes dialog-in { from { opacity: 0; transform: translateY(4px) scale(.98) } to { opacity: 1; transform: none } }
@keyframes fade-in { from { opacity: 0 } to { opacity: 1 } }
@media (prefers-reduced-motion: reduce) { *, ::before, ::after { animation-duration: .01ms !important; transition-duration: .01ms !important } }
```
Dialog surface: `animation: dialog-in 120ms ease-out`; scrim and menus: `fade-in 100ms`. Remove every `focus:outline-none` that isn't paired with a replacement ring.

**27. `EmptyState` component and the four places it goes.** — S · new `components/common/EmptyState.tsx`; `TaskTree`, `RecurrentTasksList`, `PlanView` (detail placeholder), `PlanCalendar` (empty week overlay), `StatsPanel`, `ExcusesPanel`
`flex flex-col items-center gap-2 py-10 text-center`: 24px icon in `text-text-tertiary`, `text-ui text-text-primary` title, `text-xs text-text-tertiary` hint, optional `Button variant="outlined"`. Copy: tree "No tasks yet / Create your first task" + button; detail "Nothing selected / Pick a task on the left, or click a chip on the calendar"; empty week "Nothing planned this week / Drag a task from the list, or click-and-drag on the grid"; metrics "Nothing planned or tracked in this period".

**28. Loading states: skeletons instead of "Loading…" strings.** — S/M · `PlanView.tsx`, `EvaluateView.tsx`, `TaskDetailPanel.tsx`, `Button` (#5)
- Tree first load: five `h-7 rounded-sm bg-surface-hover animate-pulse` bars at staggered widths.
- Stats first load: four tile skeletons + three row skeletons.
- Coverage line in the detail panel: a `w-32 h-4` bar instead of "Loading calendar coverage…".
- Pending buttons: keep the label, prefix a 14px spinner (`border-2 border-current border-r-transparent rounded-full animate-spin`), keep `disabled`. `disabled:opacity-50` alone makes a click feel ignored.

**29. Undo snackbar.** — M · new `components/common/Toast.tsx`, `undo/UndoProvider.tsx` · bigger lift, judgment call
Ctrl+Z undo already exists and is invisible. Show a Google-style snackbar bottom-left on every `pushUndo`: `bg-text-primary text-white rounded-sm px-4 h-12 shadow-2` with the entry's `label` ("Task deleted", "Interval moved") and an **Undo** text button in `#8ab4f8`, auto-dismiss 5s, slide-up 150ms. `pushUndo` needs a `toast?: boolean` or the provider exposes `lastEntry`. This is the largest single "this app is finished" signal and the only item here that adds a new surface.

**30. Small interaction fixes.** — S · various
- `GoogleConnectButton`: connected state → a status chip (8px green dot + "Google Calendar" `text-ui`), ghost hover, confirm-to-disconnect as now. Disconnected → `outlined` button.
- `ConfigButton`: 32px round icon button with the gear SVG, no border.
- Nav: add a wordmark at the far left, `text-[18px] font-medium text-text-secondary tracking-tight` ("Productivity"); optional, but a nav with only two tab words floats.
- Resize handles: on hover show a 2px `bg-accent` line (today `bg-accent/50` on a 4px strip); during drag set `cursor-col-resize` on `body` so the cursor doesn't flicker.
- Task name input in the detail panel: Enter → blur + save when dirty; Escape → discard. Today Enter does nothing.
- `TaskPicker` / `TaskFilter` dropdowns: `w-72` → `w-80`, `shadow-1`, rows `h-7 text-ui`, and the section headers `text-2xs`.

---

## Bigger lifts / things to weigh in on

- **#9 Dialog refactor** touches 20 files. Mechanical, but do it in one pass with #5 (Button) and #1 (tokens) so every dialog changes once.
- **#13 badge hiding** and **#16 collapsing detail column** change what's visible by default; approve or reject explicitly.
- **#20 planned-vs-tracked chip language** must be decided before the Execute → Plan merge lands, or the merge ships with indistinguishable chips.
- **#19 two-color chip split**: keep the diagonal (softened) or switch to a side stripe.
- **#10 icons**: hand-rolled SVGs vs `lucide-react`.
- **#29 snackbar**: only new UI surface in this list.
- **Font**: system stack stays. Loading Roboto/Google Sans would move closer to Google but adds a webfont flash and a dependency for a personal app; Segoe UI is already a good match. Not recommended.
- **Not proposed**: dark mode, a component library (Radix/shadcn), changing the calendar library, any color change to the accent or task palette.

---

## Recommended minimal set

If only five things ship, these give the most felt improvement per hour:

1. **#1 + #26 — tokens, shadows, scrim, transitions, focus ring.** One CSS file plus find/replace. Removes the "heavy card" look from every floating surface and makes every hover/focus animate. Roughly an hour.
2. **#5 + #9 — `Button` and `Dialog` primitives.** 13px/32px buttons, ghost hover backgrounds, 24px dialog padding, Escape/scrim close, 120ms enter. This is where the 12px-cramped feel goes away. Half a day, mostly mechanical.
3. **#10 — SVG icons with animated chevrons.** Kills the unicode-glyph look in every tree, table, picker and the nav. An hour or two.
4. **#17 + #18 + #19 + #21 — calendar pass.** Today circle instead of tinted column, 48px hours, scroll to 07:00, 4px chips with title-first and luminance-aware text, current-time dot, `‹ › Today` toolbar. An afternoon, and it's the surface you look at most.
5. **#11 + #14 + #15 — Plan left column.** Merge the tab strip with the header, action bar under the task title (which is where the v08 "start timer" button goes anyway), uniform section rhythm, "On calendar" label. Half a day.

If there's appetite for a sixth: **#29 undo snackbar**.
