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