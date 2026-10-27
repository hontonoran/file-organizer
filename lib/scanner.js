import fs from 'node:fs/promises';
import path from 'node:path';
import { EventEmitter } from 'node:events';

export async function getFiles(directory, onFileFound) {
  const files = await fs.readdir(directory, {
    recursive: true,
    withFileTypes: true
  });

  const scannedFiles = [];

  for (const file of files) {
    if (!file.isFile()) {
      continue;
    }

    const filePath = path.join(file.parentPath, file.name);
    const stats = await fs.stat(filePath);

    const fileData = {
      path: filePath,
      name: file.name,
      size: stats.size,
      extension: path.extname(file.name).toLowerCase(),
      modified: stats.mtime
    };

    scannedFiles.push(fileData);

    if (onFileFound) {
      onFileFound(fileData);
    }
  }

  return scannedFiles;
}

export function calculateStatistics(files) {
  const statistics = {
    totalFiles: files.length,
    totalSize: 0,
    byType: new Map(),
    byAge: {
      last7Days: 0,
      last30Days: 0,
      olderThan90Days: 0
    },
    largestFiles: [],
    oldestFile: null
  };

  const millisecondsPerDay = 1000 * 60 * 60 * 24;

  for (const file of files) {
    statistics.totalSize += file.size;

    const extension = file.extension || '(no extension)';

    if (!statistics.byType.has(extension)) {
      statistics.byType.set(extension, {
        count: 0,
        totalSize: 0
      });
    }

    const typeStats = statistics.byType.get(extension);

    typeStats.count += 1;
    typeStats.totalSize += file.size;

    const ageInDays =
      (Date.now() - file.modified.getTime()) / millisecondsPerDay;

    if (ageInDays <= 7) {
      statistics.byAge.last7Days++;
    }

    if (ageInDays <= 30) {
      statistics.byAge.last30Days++;
    }

    if (ageInDays > 90) {
      statistics.byAge.olderThan90Days++;
    }

    if (
      statistics.oldestFile === null ||
      file.modified < statistics.oldestFile.modified
    ) {
      statistics.oldestFile = file;
    }
  }

  statistics.largestFiles = [...files]
    .sort((a, b) => b.size - a.size)
    .slice(0, 3);

  return statistics;
}

export class Scanner extends EventEmitter {
  async scan(directory) {
    this.emit('scan-start', { directory });

    try {
      const files = await getFiles(directory, (fileData) => {
        this.emit('file-found', fileData);
      });

      const statistics = calculateStatistics(files);

      this.emit('scan-complete', statistics);

      return statistics;
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
          message = `Scan failed: ${error.message}`;
      }

      const scanError = new Error(message);
      scanError.code = error.code;

      throw scanError;
    }
  }
}