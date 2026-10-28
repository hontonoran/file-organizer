# file-organizer

### Error Handling

The scanner uses `try...catch` to handle errors during directory scanning and file operations.
Errors are converted into descriptive messages and propagated to the caller for further handling.

- `ENOENT` — File or directory not found.
- `EACCES` — Permission denied.
- `EPERM` — Operation not permitted.

### Scan Command

Recursively scans a directory and displays detailed file statistics.

**Features:**
- Total number and size of files
- File statistics grouped by extension
- File age distribution (last 7 days, last 30 days, older than 90 days)
- Top 3 largest files
- Oldest file by modification date
- Progress tracking using EventEmitter
- File system error handling

### Duplicates Command

Recursively searches for duplicate files based on their content using SHA-256 hashing.

**Features:**
- SHA-256 hashing using Node.js `crypto` module
- Memory-efficient file reading with streams
- Duplicate detection regardless of file names or extensions
- Grouping files by identical hashes
- Calculating wasted disk space
- Progress tracking using `EventEmitter`
- File system error handling