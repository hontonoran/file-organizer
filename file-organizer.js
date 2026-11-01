import { Scanner } from './lib/scanner.js';
import { DuplicateFinder } from './lib/duplicates.js';
import { Organizer } from './lib/organizer.js';
import { Cleanup } from './lib/cleanup.js';
import path from 'node:path';

const args = process.argv.slice(2);
const command = args[0];
const directory = args[1];

function formatSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 ** 2) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  if (bytes < 1024 ** 3) {
    return `${(bytes / (1024 ** 2)).toFixed(1)} MB`;
  }

  return `${(bytes / (1024 ** 3)).toFixed(2)} GB`;
}

function drawProgressBar(current, total, width = 20) {
  if (total === 0) {
    return `${'░'.repeat(width)} 0/0`;
  }

  const filled = Math.round((current / total) * width);
  const empty = width - filled;

  return `${'█'.repeat(filled)}${'░'.repeat(empty)} ${current}/${total}`;
}

function createProgress(label) {
  let total = 0;

  const line = (current) => `${label} ${drawProgressBar(current, total)}`;

  return {
    setTotal(value) {
      total = value;
    },

    update(current) {
      if (process.stdout.isTTY) {
        process.stdout.write(`\r${line(current)}`);
      }
    },

    finish(current) {
      if (process.stdout.isTTY) {
        process.stdout.write(`\r${line(current)}\n`);
      } else {
        console.log(line(current));
      }
    }
  };
}

function printScanResults(statistics) {
  console.log('\nScan Results');
  console.log('----------------------------------');
  console.log(`Total files: ${statistics.totalFiles}`);
  console.log(`Total size: ${formatSize(statistics.totalSize)}`);

  console.log('\nBy File Type:');

  for (const [extension, data] of statistics.byType) {
    console.log(
      `  ${extension}: ${data.count} files, ${formatSize(data.totalSize)}`
    );
  }

  console.log('\nFile Age:');
  console.log(`  Last 7 days: ${statistics.byAge.last7Days}`);
  console.log(`  Last 30 days: ${statistics.byAge.last30Days}`);
  console.log(`  Older than 90 days: ${statistics.byAge.olderThan90Days}`);

  console.log('\nLargest Files:');

  if (statistics.largestFiles.length === 0) {
    console.log('  No files found.');
  } else {
    statistics.largestFiles.forEach((file, index) => {
      console.log(
        `  ${index + 1}. ${file.name} (${formatSize(file.size)})`
      );
    });
  }

  if (statistics.oldestFile) {
    const oldest = statistics.oldestFile;

    const daysOld = Math.floor(
      (Date.now() - oldest.modified.getTime()) / 86400000
    );

    console.log(
      `\nOldest file: ${oldest.name} (modified ${daysOld} days ago)`
    );
  } else {
    console.log('\nOldest file: None');
  }
}

async function runScan(directory) {
  const scanner = new Scanner();
  const progress = createProgress('Processing...');
  let processedFiles = 0;

  scanner.on('scan-start', ({ directory }) => {
    console.log(`Scanning: ${path.resolve(directory)}`);
  });

  scanner.on('files-listed', ({ total }) => {
    progress.setTotal(total);
  });

  scanner.on('file-found', () => {
    processedFiles += 1;
    progress.update(processedFiles);
  });

  scanner.on('scan-complete', (statistics) => {
    progress.finish(processedFiles);
    printScanResults(statistics);
  });

  await scanner.scan(directory);
}


async function main() {
  if (!directory) {
    console.error('Error: Directory path is required.');
    console.log('Usage: node file-organizer.js <command> <directory>');
    process.exitCode = 1;
    return;
  }

  try {
    switch (command) {
      case 'scan':
        await runScan(directory);
        break;

      case 'duplicates':
        await runDuplicates(directory);
        break;

      case 'organize': {
        const outputIndex = args.indexOf('--output');
        const outputDirectory = args[outputIndex + 1];

        if (
          outputIndex === -1 ||
          !outputDirectory ||
          outputDirectory.startsWith('--')
        ) {
          throw new Error(
            'Output directory is required. Use --output <directory>.'
          );
        }

        await runOrganize(directory, outputDirectory);
        break;
      }


      case 'cleanup': {
        const olderThanIndex = args.indexOf('--older-than');
        const olderThanValue = args[olderThanIndex + 1];
        const confirm = args.includes('--confirm');

        if (
          olderThanIndex === -1 ||
          !olderThanValue ||
          olderThanValue.startsWith('--')
        ) {
          throw new Error('Use --older-than <days> to specify file age.');
        }

        const olderThan = Number(olderThanValue);

        if (!Number.isFinite(olderThan) || olderThan < 0) {
          throw new Error('--older-than must be a non-negative number.');
        }

        await runCleanup(directory, olderThan, confirm);
        break;
      }


      default:
        console.error(`Unknown command: ${command}`);
        process.exitCode = 1;
    }
  } catch (error) {
    console.error(`\nError: ${error.message}`);
    process.exitCode = 1;
  }
}

async function runDuplicates(directory) {
  const finder = new DuplicateFinder();
  const progress = createProgress('Calculating hashes...');
  let processedFiles = 0;

  finder.on('search-start', ({ directory }) => {
    console.log(`Searching for duplicates in: ${path.resolve(directory)}`);
  });

  finder.on('files-listed', ({ total }) => {
    progress.setTotal(total);
  });

  finder.on('file-processed', () => {
    processedFiles += 1;
    progress.update(processedFiles);
  });

  finder.on('duplicates-found', (results) => {
    progress.finish(processedFiles);

    console.log('\nDuplicate Search Results');
    console.log('----------------------------------');
    console.log(`Total files scanned: ${results.totalFiles}`);
    console.log(`Duplicate groups: ${results.totalGroups}`);

    results.duplicateGroups.forEach((group, index) => {
      console.log(`\nGroup ${index + 1} (${group.count} copies)`);
      console.log(`SHA-256: ${group.hash}`);
      console.log(`File size: ${formatSize(group.fileSize)}`);

      for (const file of group.files) {
        console.log(`  ${file.path}`);
      }

      console.log(`Wasted space: ${formatSize(group.wastedSpace)}`);
    });

    console.log('\n----------------------------------');
    console.log(`Total wasted space: ${formatSize(results.totalWastedSpace)}`);
  });

  await finder.findDuplicates(directory);
}

async function runOrganize(sourceDirectory, outputDirectory) {
  const organizer = new Organizer();
  const progress = createProgress('Copying files...');
  let processedFiles = 0;

  organizer.on('organize-start', ({ sourceDirectory, outputDirectory }) => {
    console.log(`Organizing: ${path.resolve(sourceDirectory)}`);
    console.log(`Output: ${path.resolve(outputDirectory)}`);
  });

  organizer.on('files-listed', ({ total }) => {
    progress.setTotal(total);
  });

  organizer.on('copy-complete', () => {
    processedFiles++;
    progress.update(processedFiles);
  });

  organizer.on('copy-error', ({ file, error }) => {
    console.error(`\nFailed to copy ${file}: ${error}`);
  });

  organizer.on('organize-complete', (summary) => {
    progress.finish(processedFiles);

    console.log('\nOrganization complete!');
    console.log('----------------------------------');

    for (const [category, count] of Object.entries(summary.byCategory)) {
      console.log(`${category}: ${count} files`);
    }

    console.log('----------------------------------');
    console.log(`Total copied: ${summary.copiedFiles} files`);
    console.log(`Total size: ${formatSize(summary.totalSize)}`);
  });

  await organizer.organize(sourceDirectory, outputDirectory);
}


async function runCleanup(directory, olderThan, confirm) {
  const cleaner = new Cleanup();
  const progress = createProgress('Deleting...');
  let deletedCount = 0;

  cleaner.on('cleanup-start', ({ directory, olderThan }) => {
    console.log(`Cleanup: ${path.resolve(directory)}`);
    console.log(`Looking for files older than ${olderThan} days...`);
  });

  cleaner.on('file-found', (file) => {
    console.log(`\n${file.path}`);
    console.log(`  Size: ${formatSize(file.size)}`);
    console.log(`  Modified: ${file.modified.toLocaleDateString()}`);
    console.log(`  Age: ${Math.floor(file.ageInDays)} days`);
  });

  cleaner.on('delete-start', ({ totalFiles, totalSize }) => {
    console.log('\n----------------------------------');
    console.log(
      `WARNING: DELETING ${totalFiles} files (${formatSize(totalSize)}). ` +
      'This action cannot be undone!\n'
    );

    progress.setTotal(totalFiles);
  });

  cleaner.on('file-deleted', () => {
    deletedCount++;
    progress.update(deletedCount);
  });

  cleaner.on('cleanup-complete', (results) => {
    if (!results.dryRun && results.totalFiles > 0) {
      progress.finish(deletedCount);
    }

    console.log('\n----------------------------------');
    console.log(`Found: ${results.totalFiles} old files`);
    console.log(`Total size: ${formatSize(results.totalSize)}`);

    if (results.dryRun) {
      console.log('\nDRY RUN: No files were deleted.');
      console.log('Use --confirm to delete these files.');
    } else {
      console.log('\nCleanup complete!');
      console.log(`Deleted: ${results.deletedFiles} files`);
      console.log(`Space freed: ${formatSize(results.deletedSize)}`);
    }
  });

  await cleaner.cleanup(directory, olderThan, confirm);
}

await main();