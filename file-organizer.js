
import { Scanner } from './lib/scanner.js';
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
  let processedFiles = 0;

  scanner.on('scan-start', ({ directory }) => {
    console.log(`Scanning: ${path.resolve(directory)}`);
  });

  scanner.on('file-found', () => {
    processedFiles += 1;
    process.stdout.write(`\rProcessed: ${processedFiles} files`);
  });

  scanner.on('scan-complete', (statistics) => {
    process.stdout.write('\r');

    console.log(
      `Processing... ${drawProgressBar(
        processedFiles,
        statistics.totalFiles
      )}`
    );

    printScanResults(statistics);
  });

  await scanner.scan(directory);
}

async function main() {
  if (!directory) {
    console.error('Error: Directory path is required.');
    console.log('Usage: node file-organizer.js scan <directory>');
    process.exitCode = 1;
    return;
  }

  try {
    switch (command) {
      case 'scan':
        await runScan(directory);
        break;

      case 'duplicates':
      case 'organize':
      case 'cleanup':
        console.log(`Command "${command}" is not implemented yet.`);
        break;

      default:
        console.error(`Unknown command: ${command}`);
        process.exitCode = 1;
    }
  } catch (error) {
    console.error(`\nError: ${error.message}`);
    process.exitCode = 1;
  }
}

await main();