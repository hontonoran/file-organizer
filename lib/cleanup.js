import fs from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import { getFiles } from './scanner.js';

export class Cleanup extends EventEmitter {
  async cleanup(directory, olderThan, confirm = false) {
    this.emit('cleanup-start', { directory, olderThan, confirm });

    try {
      if (!Number.isFinite(olderThan) || olderThan < 0) {
        throw new Error('The --older-than value must be a non-negative number.');
      }

      const files = await getFiles(directory);
      const millisecondsPerDay = 1000 * 60 * 60 * 24;

      const oldFiles = [];

      for (const file of files) {
        const ageInDays =
          (Date.now() - file.modified.getTime()) / millisecondsPerDay;

        if (ageInDays > olderThan) {
          const fileData = { ...file, ageInDays };

          oldFiles.push(fileData);
          this.emit('file-found', fileData);
        }
      }

      const totalSize = oldFiles.reduce(
        (sum, file) => sum + file.size,
        0
      );

      let deletedFiles = 0;
      let deletedSize = 0;

      if (confirm) {
        for (const file of oldFiles) {
          await fs.unlink(file.path);

          deletedFiles++;
          deletedSize += file.size;

          this.emit('file-deleted', file);
        }
      }

      const results = {
        totalFiles: oldFiles.length,
        totalSize,
        files: oldFiles,
        dryRun: !confirm,
        deletedFiles,
        deletedSize
      };

      this.emit('cleanup-complete', results);

      return results;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File or directory not found: ${error.path || directory}`);
      }

      if (error.code === 'EACCES' || error.code === 'EPERM') {
        throw new Error(`Permission denied: ${error.path || directory}`);
      }

      throw error;
    }
  }
}