import fs from 'node:fs';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { getFiles } from './scanner.js';

export function calculateHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk) => {
      hash.update(chunk);
    });

    stream.on('end', () => {
      resolve(hash.digest('hex'));
    });

    stream.on('error', reject);
  });
}

export class DuplicateFinder extends EventEmitter {
  async findDuplicates(directory) {
    this.emit('search-start', { directory });

    try {
      const files = await getFiles(directory);
      const hashGroups = new Map();

      for (const file of files) {
        const hash = await calculateHash(file.path);

        if (!hashGroups.has(hash)) {
          hashGroups.set(hash, []);
        }

        hashGroups.get(hash).push(file);

        this.emit('file-processed', {
          file,
          hash
        });
      }

      const duplicateGroups = [];
      let totalWastedSpace = 0;

      for (const [hash, group] of hashGroups) {
        if (group.length <= 1) {
          continue;
        }

        const fileSize = group[0].size;
        const wastedSpace = fileSize * (group.length - 1);

        duplicateGroups.push({
          hash,
          files: group,
          count: group.length,
          fileSize,
          wastedSpace
        });

        totalWastedSpace += wastedSpace;
      }

      const results = {
        totalFiles: files.length,
        duplicateGroups,
        totalGroups: duplicateGroups.length,
        totalWastedSpace
      };

      this.emit('duplicates-found', results);

      return results;
    } catch (error) {
      let message;

      switch (error.code) {
        case 'ENOENT':
          message = `Directory or file not found: ${error.path || directory}`;
          break;

        case 'EACCES':
        case 'EPERM':
          message = `Permission denied: ${error.path || directory}`;
          break;

        default:
          message = `Duplicate search failed: ${error.message}`;
      }

      const duplicateError = new Error(message);
      duplicateError.code = error.code;

      throw duplicateError;
    }
  }
}