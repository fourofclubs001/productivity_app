# Glossary

UI/interaction terms used in this app's code and docs, defined here since
they otherwise only exist as tribal knowledge in commit history and code
comments.

- **Kebab menu** — the ⋮ button (three dots stacked vertically) used as a
  menu trigger, e.g. the "Options" button at the top right of the task
  detail panel. Clicking it opens a **context menu** (see below). Named for
  its resemblance to a kebab skewer; the horizontal three-dot form (•••) is
  a different, unrelated pattern called a "meatball menu," not used in this
  app.
- **Context menu** (a.k.a. **overflow menu**) — the small popup list of
  actions that appears after right-clicking a calendar chip or clicking a
  kebab menu button. Implemented once, generically, as
  `frontend/src/components/calendar/ContextMenu.tsx`, and reused for both
  triggers rather than having separate components per trigger type.
