import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

// @ts-ignore — global singleton survives Next.js hot-reload
const globalWithPg = global as typeof globalThis & { _pgPool?: Pool };

export function getPool(): Pool {
  if (!globalWithPg._pgPool) {
    globalWithPg._pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return globalWithPg._pgPool;
}

let _initPromise: Promise<void> | null = null;

export function initDb(): Promise<void> {
  if (!_initPromise) {
    _initPromise = (async () => {
      const schema = fs.readFileSync(
        path.join(process.cwd(), 'lib', 'db', 'schema.sql'),
        'utf8'
      );
      await getPool().query(schema);
    })();
  }
  return _initPromise;
}
