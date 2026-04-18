import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { FocusDatabase } from '../database';
import { startOfLocalDay } from '../time';

const DEFAULT_DB_PATH = resolve(process.cwd(), 'tmp/focus-monitor.seed.db');

function parseDbPath(): string {
  const dbArg = process.argv.find((arg) => arg.startsWith('--db='));
  return dbArg ? resolve(process.cwd(), dbArg.replace('--db=', '')) : DEFAULT_DB_PATH;
}

function main(): void {
  const dbPath = parseDbPath();
  const db = new FocusDatabase(dbPath);

  const todayStart = startOfLocalDay(Date.now());
  const snapshot = db.getDailyReport(todayStart);

  assert.ok(snapshot, 'Expected daily snapshot for today');
  assert.ok(snapshot.timeline.length > 0, 'Timeline should have at least one bucket');
  assert.ok(snapshot.stats.totalMs > 0, 'Today durations should be > 0');
  assert.ok(snapshot.topApps.length <= 3, 'Top apps should have at most 3 items');

  db.close();

  console.log(
    JSON.stringify(
      {
        dbPath,
        timelineBuckets: snapshot.timeline.length,
        todayDurations: snapshot.stats,
        yesterdayDurations: snapshot.yesterdayStats,
        deltaLockedPercent: snapshot.delta.percentChange,
        topApps: snapshot.topApps,
      },
      null,
      2
    )
  );

  console.log('Smoke test passed ✅');
}

main();
