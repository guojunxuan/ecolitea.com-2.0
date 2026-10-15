import { describe, expect, it } from 'vitest'

import { createIsolatedTestDatabaseURI } from '../helpers/isolatedDatabase'

describe('isolated integration database URI', () => {
  it('keeps the configured local host and port while replacing the database name', () => {
    expect(
      createIsolatedTestDatabaseURI(
        'ecolitea2-assets-run',
        'mongodb://127.0.0.1:27119/ecolitea2-feature-blogs-int',
      ),
    ).toBe('mongodb://127.0.0.1:27119/ecolitea2-assets-run')
    expect(
      createIsolatedTestDatabaseURI('ecolitea2-assets-run', 'mongodb://127.0.0.1:27017/ecolitea-ci'),
    ).toBe('mongodb://127.0.0.1:27017/ecolitea2-assets-run')
  })

  it('refuses developer and nonlocal database targets', () => {
    expect(() => createIsolatedTestDatabaseURI('isolated', 'mongodb://127.0.0.1:27017/ecolitea2'))
      .toThrow('dedicated test database')
    expect(() => createIsolatedTestDatabaseURI('isolated', 'mongodb://db.example.com:27017/ecolitea2-test'))
      .toThrow('local MongoDB')
  })
})
