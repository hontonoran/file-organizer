
import fs from 'node:fs/promises';
import path from 'node:path';

export async function getFiles(directory) {
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

    scannedFiles.push({
      path: filePath,
      name: file.name,
      size: stats.size,
      extension: path.extname(file.name).toLowerCase(),
      modified: stats.mtime
    });
  }

  return scannedFiles;
}

export function calculateStatistics(files) {
  const statistics = {
    totalFiles: files.length,
    totalSize: 0,
    byType: new Map()
  };

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
  }

  return statistics;
}
