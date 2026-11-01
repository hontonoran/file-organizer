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
node file-organizer.js scan ~/Downloads
```

```text
Processing... ████████████████████ 16/16

Total files: 16
Total size: 33.4 MB
...
Largest Files:
  1. big.bin (11.4 MB)
```

### `duplicates`

Finds files with identical content by SHA-256 hash (read with streams) and shows wasted space for each group.

```bash
node file-organizer.js duplicates ~/Downloads
```

```text
Group 1 (2 copies)
SHA-256: efade562...
File size: 11.4 MB
  ~/Downloads/big.bin
  ~/Downloads/backup/big_copy.bin
Wasted space: 11.4 MB
```

### `organize`

Copies files into `Documents`, `Images`, `Archives`, `Code`, `Videos` and `Other` folders. Originals are never moved. Files of 10 MiB or more are copied with `pipeline()`. Name conflicts get a suffix: `report.pdf` → `report(1).pdf`.

```bash
node file-organizer.js organize ~/Downloads --output ~/Organized
```

### `cleanup`

Lists files older than `--older-than` days. Nothing is deleted unless `--confirm` is passed.

```bash
node file-organizer.js cleanup ~/Downloads --older-than 90            # dry run
node file-organizer.js cleanup ~/Downloads --older-than 90 --confirm  # delete
```

All commands show a progress bar and exit with code `1` on errors (`ENOENT`, `EACCES`, `EPERM`, invalid arguments).

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

Each class in `lib/` extends `EventEmitter`. File Organizer CLI subscribes to its events to print progress.

## Testing

```bash
npm test
```