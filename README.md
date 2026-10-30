# File Organizer

A Node.js CLI tool for scanning directories, finding duplicate files, organizing files by category, and cleaning up outdated files.

## Getting Started

**Requirements:** Node.js 20.12+ and npm.
No external runtime dependencies are required.

```bash
git clone https://github.com/hontonoran/file-organizer.git
cd file-organizer
npm install
```

## Commands

| Command | Description | Usage |
|---|---|---|
| `scan` | Recursively scans a directory and displays file statistics, including types, sizes, age, and largest files. | `node file-organizer.js scan <directory>` |
| `duplicates` | Detects identical files using SHA-256 and calculates wasted disk space. | `node file-organizer.js duplicates <directory>` |
| `organize` | Copies files into Documents, Images, Archives, Code, Videos, and Other categories. | `node file-organizer.js organize <source> --output <target>` |
| `cleanup` | Lists files older than the specified number of days without deleting them. | `node file-organizer.js cleanup <directory> --older-than <days>` |
| `cleanup --confirm` | Permanently deletes files matching the specified age threshold. | `node file-organizer.js cleanup <directory> --older-than <days> --confirm` |

Commands can also be executed through npm scripts, for example:

```bash
npm run scan -- ./test-files
```

## Technical Features

- **EventEmitter** — tracks scanning, hashing, copying, and deletion events.
- **Streams** — processes files using `createReadStream()` and copies files of 10 MiB or more with `pipeline()`.
- **SHA-256** — identifies duplicate files based on their content.
- **Safe copying** — preserves original files and resolves filename conflicts with numeric suffixes.
- **Error handling** — handles file system errors such as `ENOENT`, `EACCES`, and `EPERM`.
- **Dry run** — prevents file deletion unless `--confirm` is explicitly provided.

## Project Structure

```text
file-organizer/
├── file-organizer.js
├── lib/
│   ├── scanner.js
│   ├── duplicates.js
│   ├── organizer.js
│   └── cleanup.js
├── package.json
├── .gitignore
└── README.md
```

## Important Notes

The `organize` command copies files without removing the originals.

The `cleanup` command runs in dry run mode by default. Using `--confirm` permanently deletes matching files and cannot be undone.