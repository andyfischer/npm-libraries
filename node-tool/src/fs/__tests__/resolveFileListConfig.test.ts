
import { it, expect } from 'vitest'
import Path from 'path'
import { resolveFileListConfig } from '../resolveFileListConfig';

const sampleDir = Path.resolve(__dirname, 'samplefiles');

it("include dir-1 and file-1", async () => {
    const files = await resolveFileListConfig(sampleDir, `
        include dir-1
        include file-1
    `);
    expect(files.listAll()).toMatchInlineSnapshot(`
      [
        {
          "id": 1,
          "localPath": "/Users/andy.fischer/home/projects/rqe/src/node/fs/__tests__/samplefiles/dir-1/file-3",
          "relPath": "dir-1/file-3",
        },
        {
          "id": 2,
          "localPath": "/Users/andy.fischer/home/projects/rqe/src/node/fs/__tests__/samplefiles/file-1",
          "relPath": "file-1",
        },
      ]
    `);
});

it("include dir-2", async () => {
    const files = await resolveFileListConfig(sampleDir, `
        include dir-2
    `);
    expect(files.listAll()).toMatchInlineSnapshot(`
      [
        {
          "id": 1,
          "localPath": "/Users/andy.fischer/home/projects/rqe/src/node/fs/__tests__/samplefiles/dir-2/file-4",
          "relPath": "dir-2/file-4",
        },
        {
          "id": 2,
          "localPath": "/Users/andy.fischer/home/projects/rqe/src/node/fs/__tests__/samplefiles/dir-2/file-5",
          "relPath": "dir-2/file-5",
        },
        {
          "id": 3,
          "localPath": "/Users/andy.fischer/home/projects/rqe/src/node/fs/__tests__/samplefiles/dir-2/subdir-1/file-6",
          "relPath": "dir-2/subdir-1/file-6",
        },
      ]
    `);
});

it("exclude a nested file", async () => {
    const files = await resolveFileListConfig(sampleDir, `
        include dir-2
        exclude dir-2/file-5
    `);

    expect(files.listAll()).toMatchInlineSnapshot(`
      [
        {
          "id": 1,
          "localPath": "/Users/andy.fischer/home/projects/rqe/src/node/fs/__tests__/samplefiles/dir-2/file-4",
          "relPath": "dir-2/file-4",
        },
        {
          "id": 2,
          "localPath": "/Users/andy.fischer/home/projects/rqe/src/node/fs/__tests__/samplefiles/dir-2/subdir-1/file-6",
          "relPath": "dir-2/subdir-1/file-6",
        },
      ]
    `);
});

it("exclude a nested directory", async () => {
    const files = await resolveFileListConfig(sampleDir, `
        include dir-2
        exclude dir-2/subdir-1
    `);

    expect(files.listAll()).toMatchInlineSnapshot(`
      [
        {
          "id": 1,
          "localPath": "/Users/andy.fischer/home/projects/rqe/src/node/fs/__tests__/samplefiles/dir-2/file-4",
          "relPath": "dir-2/file-4",
        },
        {
          "id": 2,
          "localPath": "/Users/andy.fischer/home/projects/rqe/src/node/fs/__tests__/samplefiles/dir-2/file-5",
          "relPath": "dir-2/file-5",
        },
      ]
    `);
});