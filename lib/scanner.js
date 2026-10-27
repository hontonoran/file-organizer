
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
