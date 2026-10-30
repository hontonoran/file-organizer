import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { getFiles, calculateStatistics } from '../lib/scanner.js';
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