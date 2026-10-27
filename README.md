# file-organizer

### Error Handling

The scanner uses `try...catch` to handle errors during directory scanning and file operations.
Errors are converted into descriptive messages and propagated to the caller for further handling.

- `ENOENT` — File or directory not found.
- `EACCES` — Permission denied.
- `EPERM` — Operation not permitted.