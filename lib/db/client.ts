import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'reviewlens.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(path.join(process.cwd(), 'lib', 'db', 'schema.sql'), 'utf8');
  _db.exec(schema);

  return _db;
}
