export const FIVE_MINUTES_MS = 5 * 60 * 1000

export function startOfLocalDay(ts: number): number {
  const date = new Date(ts)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export function endOfLocalDay(ts: number): number {
  return startOfLocalDay(ts) + 24 * 60 * 60 * 1000
}

export function clipDuration(startTs: number, endTs: number, rangeStart: number, rangeEnd: number): number {
  const overlapStart = Math.max(startTs, rangeStart)
  const overlapEnd = Math.min(endTs, rangeEnd)
  return Math.max(0, overlapEnd - overlapStart)
}
