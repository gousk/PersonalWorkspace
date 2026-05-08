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

- Auto backup folder selection needs File System Access API support, such as Chrome or Edge.
- Gallery media uses IndexedDB for larger stored files.

## Main Areas

### Home

Dashboard for the workspace.

- Shows counts for each app area.
- Shows upcoming calendar reminders.
- Shows commonly used tags.
- Shows backup status and approximate local storage usage.

### Backlog

Board-based task tracker.

- Multiple boards.
- Custom columns.
- Tasks with tags, priority, due date, notes, checklist items, and attachments.
- Archive view for completed or removed work.
- Task detail panel.

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

Reminder and event planner.

- Monthly calendar view.
- Reminder timeline.
- Date, time, tags, notes, lead-time reminders, and pre-reminders.
- Open, done, and all filters.
- Browser-side reminder checks while the app is open.

### Health

Daily health tracking area.

- Profile settings for calorie target calculation.
- Nutrition logging with calories, protein, carbs, and fat.
- Activity logging with steps, workout minutes, and extra burn.
- Water tracking with target, quick add buttons, custom amounts, and reminders.
- Weight tracking with dated entries.
- Calendar heatmap and charts for weight, calories, net/burn, water, and steps.

## Shared Features

### Global Search

Searches across:

- Backlog tasks
- Notes
- Blog posts
- Gallery items
- Moodboards
- Calendar reminders
- Health food, water, and weight records

Search also supports tag filtering.

### Backup and Restore

Manual backup writes workspace data to the selected backup folder.

Restore imports a backup JSON file and replaces current local workspace data.

Auto backup can be configured from **Backup Settings**:

- Enable or disable auto backup.
- Choose a backup folder.
- Set backup interval in minutes.
- Set how many backup files to keep.
- Run a backup manually into the selected folder.

Auto backup checks when the app starts, while it is open, and when visibility changes. It only writes a new backup when the configured interval has passed.

### Blackout Mode

A fixed bottom-right button opens a fullscreen blackout overlay. Press `Esc` to exit.

## Data Storage

The app is local-first.

- App records are stored in `localStorage`.
- Larger Gallery media is stored in IndexedDB.
- Backup folder handles are stored in IndexedDB.
- No server or database is required.

Storage keys used by the app include:

- `ws_backlog`
- `ws_notes`
- `ws_blog`
- `ws_gallery`
- `ws_moodboard`
- `ws_calendar`
- `ws_health`
- `ws_backup_settings`

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
- Data lives in the browser profile unless exported with backup.
