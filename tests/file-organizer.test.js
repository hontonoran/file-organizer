import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { Scanner, getFiles, calculateStatistics } from '../lib/scanner.js';
import { DuplicateFinder } from '../lib/duplicates.js';
import { Organizer, getCategory } from '../lib/organizer.js';
import { Cleanup } from '../lib/cleanup.js';

async function createTestDirectory(t) {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'file-organizer-test-')
  );

  t.after(async () => {
    await fs.rm(directory, { recursive: true, force: true });
  });

  return directory;
}

test('Scanner finds files recursively', async (t) => {
  const directory = await createTestDirectory(t);
  const nested = path.join(directory, 'documents');

  await fs.mkdir(nested);
  await fs.writeFile(path.join(directory, 'notes.txt'), 'Hello');
  await fs.writeFile(path.join(nested, 'report.pdf'), 'Report');

  const files = await getFiles(directory);
  const statistics = calculateStatistics(files);

  assert.equal(files.length, 2);
  assert.equal(statistics.totalFiles, 2);
  assert.equal(statistics.totalSize, 11);
  assert.equal(statistics.byType.get('.txt').count, 1);
  assert.equal(statistics.byType.get('.pdf').count, 1);
});

test('DuplicateFinder detects identical files', async (t) => {
  const directory = await createTestDirectory(t);

  await fs.writeFile(path.join(directory, 'first.txt'), 'Same content');
  await fs.writeFile(path.join(directory, 'second.txt'), 'Same content');
  await fs.writeFile(path.join(directory, 'third.txt'), 'Different');

  const finder = new DuplicateFinder();
  const results = await finder.findDuplicates(directory);

  assert.equal(results.totalFiles, 3);
  assert.equal(results.totalGroups, 1);
  assert.equal(results.duplicateGroups[0].count, 2);
  assert.equal(results.totalWastedSpace, 12);
});

test('getCategory returns the correct category', () => {
  assert.equal(getCategory('photo.jpg'), 'Images');
  assert.equal(getCategory('report.pdf'), 'Documents');
  assert.equal(getCategory('archive.zip'), 'Archives');
  assert.equal(getCategory('script.js'), 'Code');
  assert.equal(getCategory('movie.mp4'), 'Videos');
  assert.equal(getCategory('unknown.xyz'), 'Other');
});

test('Organizer copies files into categories', async (t) => {
  const directory = await createTestDirectory(t);
  const source = path.join(directory, 'source');
  const output = path.join(directory, 'output');

  await fs.mkdir(source);
  await fs.writeFile(path.join(source, 'notes.txt'), 'Hello');
  await fs.writeFile(path.join(source, 'photo.jpg'), 'Image');

  const organizer = new Organizer();
  const results = await organizer.organize(source, output);

  assert.equal(results.copiedFiles, 2);
  assert.equal(results.byCategory.Documents, 1);
  assert.equal(results.byCategory.Images, 1);

  assert.equal(
    await fs.readFile(path.join(output, 'Documents', 'notes.txt'), 'utf8'),
    'Hello'
  );

  assert.equal(
    await fs.readFile(path.join(source, 'notes.txt'), 'utf8'),
    'Hello'
  );
});

test('Organizer prevents overwriting existing files', async (t) => {
  const directory = await createTestDirectory(t);
  const source = path.join(directory, 'source');
  const output = path.join(directory, 'output');

  await fs.mkdir(source);
  await fs.writeFile(path.join(source, 'notes.txt'), 'Hello');

  const organizer = new Organizer();

  await organizer.organize(source, output);
  await organizer.organize(source, output);

  const files = await fs.readdir(path.join(output, 'Documents'));

  assert.deepEqual(files.sort(), ['notes(1).txt', 'notes.txt']);
});

test('Cleanup dry run does not delete files', async (t) => {
  const directory = await createTestDirectory(t);
  const oldFile = path.join(directory, 'old.txt');

  await fs.writeFile(oldFile, 'Old content');

  const oldDate = new Date('2020-01-01');
  await fs.utimes(oldFile, oldDate, oldDate);

  const cleanup = new Cleanup();
  const results = await cleanup.cleanup(directory, 90);

  assert.equal(results.dryRun, true);
  assert.equal(results.totalFiles, 1);
  assert.equal(results.deletedFiles, 0);

  assert.equal(await fs.readFile(oldFile, 'utf8'), 'Old content');
});

test('Cleanup deletes old files only with confirmation', async (t) => {
  const directory = await createTestDirectory(t);
  const oldFile = path.join(directory, 'old.txt');
  const newFile = path.join(directory, 'new.txt');

  await fs.writeFile(oldFile, 'Old content');
  await fs.writeFile(newFile, 'New content');

  const oldDate = new Date('2020-01-01');
  await fs.utimes(oldFile, oldDate, oldDate);

  const cleanup = new Cleanup();
  const results = await cleanup.cleanup(directory, 90, true);

  assert.equal(results.dryRun, false);
  assert.equal(results.deletedFiles, 1);

  await assert.rejects(fs.access(oldFile), { code: 'ENOENT' });
  assert.equal(await fs.readFile(newFile, 'utf8'), 'New content');
});

test('Organizer rejects output inside source directory', async (t) => {
  const directory = await createTestDirectory(t);
  const output = path.join(directory, 'output');

  const organizer = new Organizer();

  await assert.rejects(
    organizer.organize(directory, output),
    /Output directory cannot be inside the source directory/
  );
});


test('Scanner emits file-found and scan-complete events', async (t) => {
  const directory = await createTestDirectory(t);

  await fs.writeFile(path.join(directory, 'notes.txt'), 'Hello');

  const scanner = new Scanner();
  const foundFiles = [];
  let completedStatistics = null;

  scanner.on('file-found', (file) => {
    foundFiles.push(file.name);
  });

  scanner.on('scan-complete', (statistics) => {
    completedStatistics = statistics;
  });

  await scanner.scan(directory);

  assert.deepEqual(foundFiles, ['notes.txt']);
  assert.equal(completedStatistics.totalFiles, 1);
});

test('DuplicateFinder emits processing and results events', async (t) => {
  const directory = await createTestDirectory(t);

  await fs.writeFile(path.join(directory, 'first.txt'), 'Same');
  await fs.writeFile(path.join(directory, 'second.txt'), 'Same');

  const finder = new DuplicateFinder();
  const processedFiles = [];
  let duplicateResults = null;

  finder.on('file-processed', ({ file, hash }) => {
    processedFiles.push(file.name);
    assert.equal(hash.length, 64);
  });

  finder.on('duplicates-found', (results) => {
    duplicateResults = results;
  });

  await finder.findDuplicates(directory);

  assert.deepEqual(processedFiles.sort(), ['first.txt', 'second.txt']);
  assert.equal(duplicateResults.totalGroups, 1);
  assert.equal(duplicateResults.duplicateGroups[0].count, 2);
});

test('Organizer emits copy-start and copy-complete events', async (t) => {
  const directory = await createTestDirectory(t);
  const source = path.join(directory, 'source');
  const output = path.join(directory, 'output');

  await fs.mkdir(source);
  await fs.writeFile(path.join(source, 'photo.jpg'), 'Image');

  const organizer = new Organizer();
  const events = [];

  organizer.on('copy-start', ({ source }) => {
    events.push('start');
    assert.equal(path.basename(source), 'photo.jpg');
  });

  organizer.on('copy-complete', ({ target, category }) => {
    events.push('complete');
    assert.equal(category, 'Images');
    assert.equal(path.basename(target), 'photo.jpg');
  });

  await organizer.organize(source, output);

  assert.deepEqual(events, ['start', 'complete']);
});

test('Cleanup emits file-found, file-deleted and cleanup-complete events', async (t) => {
  const directory = await createTestDirectory(t);
  const oldFile = path.join(directory, 'old.txt');

  await fs.writeFile(oldFile, 'Old content');

  const oldDate = new Date('2020-01-01');
  await fs.utimes(oldFile, oldDate, oldDate);

  const cleanup = new Cleanup();
  const events = [];
  let completedResults = null;

  cleanup.on('file-found', (file) => {
    events.push('found');
    assert.equal(file.name, 'old.txt');
  });

  cleanup.on('file-deleted', (file) => {
    events.push('deleted');
    assert.equal(file.name, 'old.txt');
  });

  cleanup.on('cleanup-complete', (results) => {
    events.push('complete');
    completedResults = results;
  });

  await cleanup.cleanup(directory, 90, true);

  assert.deepEqual(events, ['found', 'deleted', 'complete']);
  assert.equal(completedResults.deletedFiles, 1);

  await assert.rejects(fs.access(oldFile), { code: 'ENOENT' });
});

test('Scanner emits files-listed with the total before file-found events', async (t) => {
  const directory = await createTestDirectory(t);

  await fs.writeFile(path.join(directory, 'a.txt'), 'A');
  await fs.writeFile(path.join(directory, 'b.txt'), 'B');

  const scanner = new Scanner();
  const events = [];

  scanner.on('files-listed', ({ total }) => events.push(`listed:${total}`));
  scanner.on('file-found', () => events.push('found'));
  scanner.on('scan-complete', () => events.push('complete'));

  await scanner.scan(directory);

  assert.deepEqual(events, ['listed:2', 'found', 'found', 'complete']);
});

test('DuplicateFinder and Organizer emit files-listed with the total', async (t) => {
  const directory = await createTestDirectory(t);
  const source = path.join(directory, 'source');

  await fs.mkdir(source);
  await fs.writeFile(path.join(source, 'a.txt'), 'A');
  await fs.writeFile(path.join(source, 'b.txt'), 'B');
  await fs.writeFile(path.join(source, 'c.txt'), 'C');

  const finder = new DuplicateFinder();
  let finderTotal = null;
  finder.on('files-listed', ({ total }) => { finderTotal = total; });
  await finder.findDuplicates(source);

  const organizer = new Organizer();
  let organizerTotal = null;
  organizer.on('files-listed', ({ total }) => { organizerTotal = total; });
  await organizer.organize(source, path.join(directory, 'output'));

  assert.equal(finderTotal, 3);
  assert.equal(organizerTotal, 3);
});

test('Cleanup emits delete-start only when --confirm is used', async (t) => {
  const directory = await createTestDirectory(t);
  const oldFile = path.join(directory, 'old.txt');

  await fs.writeFile(oldFile, 'Old content');

  const oldDate = new Date('2020-01-01');
  await fs.utimes(oldFile, oldDate, oldDate);

  const dryRunCleanup = new Cleanup();
  let dryRunStarted = false;
  dryRunCleanup.on('delete-start', () => { dryRunStarted = true; });
  await dryRunCleanup.cleanup(directory, 90);

  assert.equal(dryRunStarted, false);

  const realCleanup = new Cleanup();
  let deleteStart = null;
  realCleanup.on('delete-start', (data) => { deleteStart = data; });
  await realCleanup.cleanup(directory, 90, true);

  assert.equal(deleteStart.totalFiles, 1);
  assert.equal(deleteStart.totalSize, 11);
});

test('Scanner skips an unreadable subdirectory and keeps going', async (t) => {
  const directory = await createTestDirectory(t);
  const locked = path.join(directory, 'locked');

  await fs.writeFile(path.join(directory, 'a.txt'), 'A');
  await fs.mkdir(locked);
  await fs.writeFile(path.join(locked, 'secret.txt'), 'S');
  await fs.chmod(locked, 0o000);

  try {
    const scanner = new Scanner();
    const skipped = [];
    scanner.on('file-skipped', ({ path: skippedPath }) => skipped.push(skippedPath));

    const statistics = await scanner.scan(directory);

    assert.equal(statistics.totalFiles, 1);
    assert.equal(statistics.skippedFiles, 1);
    assert.deepEqual(skipped, [locked]);
  } finally {
    await fs.chmod(locked, 0o755);
  }
});

test('DuplicateFinder and Organizer skip an unreadable file and keep going', async (t) => {
  const directory = await createTestDirectory(t);
  const source = path.join(directory, 'source');
  const locked = path.join(source, 'locked.txt');

  await fs.mkdir(source);
  await fs.writeFile(path.join(source, 'a.txt'), 'A');
  await fs.writeFile(locked, 'L');
  await fs.chmod(locked, 0o000);

  try {
    const finder = new DuplicateFinder();
    const results = await finder.findDuplicates(source);

    assert.equal(results.skippedFiles, 1);

    const organizer = new Organizer();
    const errors = [];
    organizer.on('copy-error', ({ file }) => errors.push(file));

    const summary = await organizer.organize(source, path.join(directory, 'output'));

    assert.equal(summary.copiedFiles, 1);
    assert.equal(summary.skippedFiles, 1);
    assert.deepEqual(errors, [locked]);
  } finally {
    await fs.chmod(locked, 0o644);
  }
});

test('Cleanup --confirm with no old files does not emit delete-start', async (t) => {
  const directory = await createTestDirectory(t);

  await fs.writeFile(path.join(directory, 'fresh.txt'), 'New');

  const cleanup = new Cleanup();
  let deleteStarted = false;
  cleanup.on('delete-start', () => { deleteStarted = true; });

  const results = await cleanup.cleanup(directory, 90, true);

  assert.equal(deleteStarted, false);
  assert.equal(results.totalFiles, 0);
});
