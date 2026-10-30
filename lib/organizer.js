import { EventEmitter } from 'node:events';
import { getFiles } from './scanner.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

export const categories = {
  Documents: ['.pdf', '.docx', '.doc', '.txt', '.md', '.xlsx', '.pptx'],
  Images: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp'],
  Archives: ['.zip', '.rar', '.tar', '.gz', '.7z'],
  Code: ['.js', '.py', '.java', '.cpp', '.html', '.css', '.json'],
  Videos: ['.mp4', '.avi', '.mkv', '.mov', '.webm'],
  Other: []
};

export function getCategory(fileName) {
  const extension = path.extname(fileName).toLowerCase();

  for (const [category, extensions] of Object.entries(categories)) {
    if (extensions.includes(extension)) {
      return category;
    }
  }

  return 'Other';
}

export async function createCategoryFolders(outputDirectory) {
  for (const category of Object.keys(categories)) {
    const folderPath = path.join(outputDirectory, category);

    await fs.mkdir(folderPath, { recursive: true });
  }
}


export async function copyFile(sourcePath, targetPath) {
  const stats = await fs.stat(sourcePath);
  const largeFileThreshold = 10 * 1024 * 1024;

  if (stats.size < largeFileThreshold) {
    await fs.copyFile(sourcePath, targetPath, fs.constants.COPYFILE_EXCL);
  } else {
    await pipeline(
      createReadStream(sourcePath),
      createWriteStream(targetPath, { flags: 'wx' })
    );
  }
}


export async function getUniquePath(targetPath) {
  const directory = path.dirname(targetPath);
  const extension = path.extname(targetPath);
  const fileName = path.basename(targetPath, extension);

  let newPath = targetPath;
  let counter = 1;

  while (true) {
    try {
      await fs.access(newPath);

      newPath = path.join(
        directory,
        `${fileName}(${counter})${extension}`
      );

      counter++;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return newPath;
      }

      throw error;
    }
  }
}


export class Organizer extends EventEmitter {
  async organize(sourceDirectory, outputDirectory) {
    this.emit('organize-start', {
      sourceDirectory,
      outputDirectory
    });

    try {
      const source = path.resolve(sourceDirectory);
      const output = path.resolve(outputDirectory);

      if (source === output || output.startsWith(source + path.sep)) {
        throw new Error('Output directory cannot be inside the source directory.');
      }

      const files = await getFiles(source);
      await createCategoryFolders(output);

      const summary = {
        totalFiles: files.length,
        copiedFiles: 0,
        totalSize: 0,
        byCategory: Object.fromEntries(
          Object.keys(categories).map(category => [category, 0])
        )
      };

      for (const file of files) {
        const category = getCategory(file.name);
        const categoryDirectory = path.join(output, category);
        const targetPath = path.join(categoryDirectory, file.name);

        this.emit('copy-start', {
          source: file.path,
          target: targetPath
        });

        try {
          const uniquePath = await getUniquePath(targetPath);

          await copyFile(file.path, uniquePath);

          summary.copiedFiles++;
          summary.totalSize += file.size;
          summary.byCategory[category]++;

          this.emit('copy-complete', {
            source: file.path,
            target: uniquePath,
            category
          });
        } catch (error) {
          this.emit('copy-error', {
            file: file.path,
            error: error.message
          });

          throw error;
        }
      }

      this.emit('organize-complete', summary);

      return summary;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File or directory not found: ${error.path || sourceDirectory}`);
      }

      if (error.code === 'EACCES' || error.code === 'EPERM') {
        throw new Error(`Permission denied: ${error.path || sourceDirectory}`);
      }

      throw error;
    }
  }
}