import dotenv from 'dotenv';
dotenv.config();

import pool from '../src/config/database';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('Starting database migration...');

    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/002_ensure_analytics_fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing migration: 002_ensure_analytics_fields.sql');

    await client.query(migrationSQL);

    console.log('Migration completed successfully!');

    // Verify the columns exist
    const verifyQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'click_logs'
        AND column_name IN ('country', 'city', 'device_type', 'os', 'browser')
      ORDER BY column_name;
    `;

    const result = await client.query(verifyQuery);

    console.log('\nVerified columns in click_logs table:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
