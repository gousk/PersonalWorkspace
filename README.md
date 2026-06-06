# Personal Workspace

This site and this README were made through vibecoding.

Local-first personal workspace built as a single browser app. It stores data in the browser and runs from `platform.html`.

## Contents

- [Running](#running)
- [Main Areas](#main-areas)
- [Shared Features](#shared-features)
- [Data Storage](#data-storage)
- [Project Structure](#project-structure)

## Running

Open `platform.html` in a browser.

No build step is required. The app is plain HTML, CSS, and JavaScript.

Some features use browser APIs:

- Auto backup, the shared data folder, and folder reconnect need File System Access API support, such as Chrome or Edge.
- Gallery media uses IndexedDB for larger stored files.
- Folder handles (backup and shared) are stored in IndexedDB so they persist between sessions.

Use `Alt+1` through `Alt+8` to jump between the main areas, and `Ctrl+K` to open global search.

## Main Areas

### Home

Dashboard for the workspace.

- Shows counts for each app area.
- Shows upcoming calendar reminders.
- Shows commonly used tags.
- Shows backup status, last restore, and approximate local storage usage.
- Quick action to create a backup.

### Backlog

Board-based task tracker.

- Multiple boards.
- Custom columns.
- Tasks with tags, priority, due date, notes, checklist items, and attachments.
- Archive view for completed or removed work.
- Task detail panel.
- Board-level linked items, so a whole board can be linked to other workspace records.

### Notes

Simple note capture area.

- Create, edit, pin, and delete notes.
- Search notes.
- Add comma-separated tags.
- Filter with tag chips.

### Blog

Block-based writing area.

- Draft and published post states.
- Post title, slug, tags, excerpt, and cover image.
- Content blocks: text, headings, quote, callout, code, list, image, and divider.
- Reorder and delete blocks.
- Search and filter posts.

### Gallery

Media library for images, GIFs, and videos.

- Multi-file upload.
- Search, type filters, favorites, and tag filters.
- Folder creation, folder filtering, and media moving.
- Selection mode for bulk actions: select all visible media, move selected media to a folder, or delete selected media.
- Lightbox viewer with metadata controls.
- Image files are stored as full media in IndexedDB and lightweight previews in localStorage.

### Moodboard

Free-form canvas for visual planning.

- Multiple moodboards.
- Add images, videos, GIFs, and text.
- Add assets from the Gallery or upload directly.
- Move, resize, rotate, duplicate, delete, and layer items.
- Edit text by double clicking.
- Pan the canvas with middle mouse.
- Zoom with the mouse wheel.
- Canvas background color, dot visibility, and dot strength controls.
- 16:9 canvas area with viewport-aware placement and clamping.

### Calendar

Reminder, event, and birthday planner.

- Monthly calendar view with markers for events and birthdays.
- **Events** view with a reminder timeline and open, upcoming, all, and done filters.
- **Birthdays** view for recurring yearly birthdays.
- Click a day to filter the list to that day; new entries default to the selected day.
- Events support a title, date, time, tags, notes, and multiple reminder offsets.
- Each reminder offset is a lead time in days and minutes before the event, so one event can fire several reminders (for example one day before and ten minutes before).
- Birthdays support a name, month and day, optional birth year, reminder lead days, and notes. They show the next date, the age being turned, and days until.
- Convert an event into a birthday from the event editor.
- Browser-side reminder checks run while the app is open, with on-screen reminder toasts (open, snooze, dismiss) and a sound cue.

### Health

Daily health tracking area.

- Profile settings for calorie target calculation, with editable protein, fiber, sodium, potassium, and water targets.
- Nutrition logging with calories, protein, carbs, fat, fiber, sodium, and potassium.
- Food entries use a quantity multiplier: per-serving values are entered once, then scaled by quantity at add time or with a per-row stepper.
- Edit, duplicate, or delete logged foods, and save any food as a preset.
- Saved food presets are editable and can be quick-logged from chips or a manage-presets dialog.
- Daily progress bars and remaining amounts for calories, protein, fiber, sodium, potassium, and water.
- Activity logging with steps, workout minutes, and extra burn.
- Water tracking with target, quick add buttons, custom amounts, removable individual log entries, and reminders.
- Hydration reminders run from any page once the app is open, not only while the Health area is visible.
- Weight tracking with dated entries.
- Calendar heatmap and charts for weight, calories, net/burn, water, and steps.

## Shared Features

### Global Search

Searches across:

- Backlog boards and tasks
- Notes
- Blog posts
- Gallery items
- Moodboards
- Calendar reminders and birthdays
- Health food, water, and weight records

Search also supports tag filtering.

### Cross-App Links

Backlog boards and tasks, notes, blog posts, gallery media, moodboards, calendar reminders, and health days can be linked to each other.

- Open a record and use **Linked Items** to attach another workspace item.
- Links are bidirectional, so linking a backlog task to a blog post also shows the backlink from the blog post.
- Linked items and the link picker are grouped by app and by backlog board for easier scanning.
- Moodboard media that came from the Gallery and moodboard Gallery folders are surfaced as related items.

### Backup and Restore

Manual backup writes workspace data to the selected backup folder.

Restore imports a backup JSON file and replaces current local workspace data. The restore is transactional, so existing data is kept if the import cannot complete.

Auto backup can be configured from **Backup Settings**:

- Enable or disable auto backup.
- Choose a backup folder, or reconnect it if a browser session dropped folder permission.
- Set backup interval in minutes.
- Set how many backup files to keep.
- Run a backup manually into the selected folder.

Auto backup checks when the app starts, while it is open, and when visibility changes. It only writes a new backup when the configured interval has passed. Settings are read defensively so a corrupt or partial value falls back per field instead of resetting the whole configuration.

### Shared Data Sync

Shared data sync keeps one copy of the workspace in a shared folder so different users or profiles on the same machine can work from the same data. It is configured from **Backup Settings**.

- Choose a shared folder that each user points at, for example a folder readable by every account on the machine.
- The app keeps a single `workspace-shared.json` file in that folder.
- Local changes are written to the shared file shortly after they are saved.
- The shared file is read on startup, on focus, and when visibility changes, and is applied only when it is newer than the local copy (last write wins by timestamp).
- **Push Shared** and **Pull Shared** force a write or read on demand.
- When sync is first enabled and a shared file already exists, you are asked to use the shared data, keep local data, or merge the two.
- Empty or partial payloads are never written, and applying shared data is transactional, to avoid data loss.

### Blackout Mode

A fixed bottom-right button opens a fullscreen blackout overlay. Press `Esc` to exit.

## Data Storage

The app is local-first.

- App records are stored in `localStorage`.
- Larger Gallery media is stored in IndexedDB.
- Backup and shared folder handles are stored in IndexedDB.
- The shared data file (`workspace-shared.json`) lives in the chosen shared folder.
- No server or database is required.

Storage keys used by the app include:

- `ws_backlog`
- `ws_notes`
- `ws_blog`
- `ws_gallery`
- `ws_moodboard`
- `ws_calendar`
- `ws_health`
- `ws_links`
- `ws_backup_settings`
- `ws_calendar_reminder_log`
- `ws_calendar_reminder_snooze`

The app also stores small helper keys such as `ws_last_page`, `ws_last_backup`, and `ws_last_restore`.

## Project Structure

```text
.
|-- platform.html
|-- styles/
|   `-- main.css
`-- scripts/
    |-- core.js
    |-- main.js
    `-- apps/
        |-- backlog.js
        |-- blog.js
        |-- calendar.js
        |-- gallery.js
        |-- health.js
        |-- moodboard.js
        `-- notes.js
```

## Notes

- The app currently has no package manager setup.
- There is no automated build or test runner.
- Data lives in the browser profile unless exported with backup or shared through a shared folder.
```