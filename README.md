# File Organizer

A Node.js CLI tool for scanning directories, finding duplicate files, organizing files by category, and cleaning up outdated files.

## Getting Started

**Requirements:** Node.js 20.12+. No external dependencies, so no `npm install` is needed.

```bash
git clone https://github.com/hontonoran/file-organizer.git
cd file-organizer
node file-organizer.js scan ~/Downloads
```

## Usage

```text
node file-organizer.js <command> <directory> [options]
```

| Argument / option | Used by | Description |
|---|---|---|
| `<directory>` | all commands | Directory to process (searched recursively). |
| `--output <target>` | `organize` | **Required.** Destination directory. Created if missing; cannot be inside the source. |
| `--older-than <days>` | `cleanup` | **Required.** Files modified more than this many days ago are considered old. |
| `--confirm` | `cleanup` | Actually delete the files. Without it, `cleanup` only lists them (dry run). |

Commands can also be run through npm scripts: `npm run scan -- ~/Downloads`.

## Commands

### `scan`

Shows total files and size, statistics per file type, file age (7 / 30 / 90+ days), the 3 largest files and the oldest file.

```bash
node file-organizer.js scan /Users/username/Downloads
```

```text
Scanning: /Users/username/Downloads
Processing... ████████████████████ 20/20

Scan Results
----------------------------------
Total files: 20
Total size: 20.3 MB

By File Type:
  .md: 2 files, 60 B
  .png: 12 files, 8.0 MB
  .csv: 1 files, 26 B
  .mp4: 1 files, 12.0 MB
  .zip: 1 files, 46.9 KB
  .js: 1 files, 22 B
  .pdf: 2 files, 290.0 KB

File Age:
  Last 7 days: 18
  Last 30 days: 18
  Older than 90 days: 2

Largest Files:
  1. de_smetana_meme.mp4 (12.0 MB)
  2. Screenshot 2026-06-12 at 10.23.51.png (1.7 MB)
  3. cat9.png (934.6 KB)

Oldest file: invoice-2025-03.pdf (modified 596 days ago)
```

### `duplicates`

Finds files with identical content by SHA-256 hash (read with streams) and shows wasted space for each group: `file size × (copies − 1)`.

```bash
node file-organizer.js duplicates /Users/username/Downloads
```

```text
Searching for duplicates in: /Users/username/Downloads
Calculating hashes... ████████████████████ 20/20

Duplicate Search Results
----------------------------------
Total files scanned: 20
Duplicate groups: 2

Group 1 (2 copies)
SHA-256: 728be95cc24dcf9418e72825909c2bfec7f5e6e5e6c4ef6df7774bc7e25594cf
File size: 30 B
  /Users/username/Downloads/README.md
  /Users/username/Downloads/README_1.md
Wasted space: 30 B

Group 2 (2 copies)
SHA-256: 2aac69861c530f84c4783b9b029bd98b4975b8c9793fd9ca32a3dbb61f0ba0d2
File size: 293.0 KB
  /Users/username/Downloads/cat.png
  /Users/username/Downloads/backup/cat.png
Wasted space: 293.0 KB

----------------------------------
Total wasted space: 293.0 KB
```

### `organize`

Copies files into `Documents`, `Images`, `Archives`, `Code`, `Videos` and `Other` folders. Originals are never moved. Files of 10 MiB or more (here `de_smetana_meme.mp4`) are copied with `pipeline()`. Name conflicts get a suffix: `cat.png` and `backup/cat.png` end up as `Images/cat.png` and `Images/cat(1).png`.

```bash
node file-organizer.js organize /Users/username/Downloads --output /Users/username/Organized
```

```text
Organizing: /Users/username/Downloads
Output: /Users/username/Organized
Copying files... ████████████████████ 20/20

Organization complete!
----------------------------------
Documents: 4 files
Images: 12 files
Archives: 1 files
Code: 1 files
Videos: 1 files
Other: 1 files
----------------------------------
Total copied: 20 files
Total size: 20.3 MB
```

### `cleanup`

Lists files older than `--older-than` days. Nothing is deleted unless `--confirm` is passed.

**Dry run:**

```bash
node file-organizer.js cleanup /Users/username/Downloads --older-than 90
```

```text
Cleanup: /Users/username/Downloads
Looking for files older than 90 days...

/Users/username/Downloads/Screenshot 2026-06-12 at 10.23.51.png
  Size: 1.7 MB
  Modified: 6/12/2026
  Age: 142 days

/Users/username/Downloads/invoice-2025-03.pdf
  Size: 141.6 KB
  Modified: 3/15/2025
  Age: 596 days

----------------------------------
Found: 2 old files
Total size: 1.9 MB

DRY RUN: No files were deleted.
Use --confirm to delete these files.
```

**Deletion:**

```bash
node file-organizer.js cleanup /Users/username/Downloads --older-than 90 --confirm
```

```text
... (same list of files) ...

----------------------------------
WARNING: DELETING 2 files (1.9 MB). This action cannot be undone!

Deleting... ████████████████████ 2/2

----------------------------------
Found: 2 old files
Total size: 1.9 MB

Cleanup complete!
Deleted: 2 files
Space freed: 1.9 MB
```

## EventEmitter

Each command is a class in `lib/` that extends `EventEmitter`. The classes only emit events; `file-organizer.js` subscribes to them to draw the progress bar and print results.

| Class | Events |
|---|---|
| `Scanner` | `scan-start`, `files-listed`, `file-found`, `scan-complete` |
| `DuplicateFinder` | `search-start`, `files-listed`, `file-processed`, `duplicates-found` |
| `Organizer` | `organize-start`, `files-listed`, `copy-start`, `copy-complete`, `copy-error`, `organize-complete` |
| `Cleanup` | `cleanup-start`, `file-found`, `delete-start`, `file-deleted`, `cleanup-complete` |

`files-listed` (`{ total }`) gives the total number of files before processing starts, so the progress bar can show `current/total`.

## Error Handling

All file system operations are wrapped in `try...catch`. On any error the message is printed and the process exits with code `1`.

| Code | Message |
|---|---|
| `ENOENT` | `Directory or file not found: <path>` |
| `EACCES`, `EPERM` | `Permission denied: <path>` |
| other (e.g. `ENOTDIR`) | original error message |
| invalid arguments | e.g. `Output directory is required. Use --output <directory>.` |

## Project Structure

```text
file-organizer/
├── file-organizer.js         # CLI: argument parsing, output, progress bar
├── lib/
│   ├── scanner.js            # Scanner + shared getFiles()
│   ├── duplicates.js         # DuplicateFinder
│   ├── organizer.js          # Organizer
│   └── cleanup.js            # Cleanup
├── tests/
│   └── file-organizer.test.js
├── package.json
├── .gitignore
└── README.md
```

## Testing

```bash
npm test
```