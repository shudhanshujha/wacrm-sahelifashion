/**
 * Send throttling and scheduling utilities for WhatsApp broadcasts.
 *
 * WhatsApp Business API imposes tier-based messaging limits:
 * - Tier 1: 250 unique contacts per 24h
 * - Tier 2: 500 unique contacts per 24h
 * - Tier 3: 2.5K unique contacts per 24h
 * - Tier 4: 25K+ unique contacts per 24h (grows with quality)
 *
 * To respect these limits, large broadcasts should be throttled:
 * batched over time so we never exceed the daily cap.
 */

export interface ThrottleConfig {
  /** Current messaging tier limit (unique contacts per 24h) */
  dailyLimit: number;
  /** How many unique contacts have already been messaged today */
  usedToday: number;
  /** How many recipients we want to send to */
  targetCount: number;
  /** Batch size per send burst */
  batchSize: number;
  /** Delay between batches in ms */
  batchDelayMs: number;
}

export interface ThrottlePlan {
  /** Can send today */
  canSendToday: boolean;
  /** How many can be sent today */
  todayCapacity: number;
  /** How many need to be queued for tomorrow */
  queuedForTomorrow: number;
  /** Number of batches needed */
  totalBatches: number;
  /** Estimated duration in ms */
  estimatedDurationMs: number;
  /** Warning message if limit is exceeded */
  warning?: string;
}

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_BATCH_DELAY_MS = 1000;
const TIER_NAMES: Record<number, string> = {
  250: 'Tier 1',
  500: 'Tier 2',
  2500: 'Tier 3',
  25000: 'Tier 4',
};

/**
 * Calculate a throttled send plan based on current tier limits.
 */
export function calculateThrottlePlan(config: ThrottleConfig): ThrottlePlan {
  const {
    dailyLimit,
    usedToday,
    targetCount,
    batchSize = DEFAULT_BATCH_SIZE,
    batchDelayMs = DEFAULT_BATCH_DELAY_MS,
  } = config;

  const remaining = Math.max(0, dailyLimit - usedToday);
  const canSendToday = targetCount <= remaining;
  const todayCapacity = Math.min(targetCount, remaining);
  const queuedForTomorrow = Math.max(0, targetCount - remaining);
  const totalBatches = Math.ceil(todayCapacity / batchSize);
  const estimatedDurationMs = totalBatches * batchDelayMs;

  let warning: string | undefined;
  if (!canSendToday) {
    const tierName = TIER_NAMES[dailyLimit] ?? `Limit ${dailyLimit}`;
    warning =
      `Your account is on ${tierName} (${dailyLimit} contacts/24h). ` +
      `You've used ${usedToday} today. ${todayCapacity} will be sent now; ` +
      `${queuedForTomorrow} will be queued for tomorrow.`;
  }

  return {
    canSendToday,
    todayCapacity,
    queuedForTomorrow,
    totalBatches,
    estimatedDurationMs,
    warning,
  };
}

/**
 * Create a throttled send schedule: chunks of recipients with timing.
 * Returns an array of batches, each with a `sendAt` timestamp.
 */
export function createSendSchedule(
  recipientCount: number,
  config: Partial<ThrottleConfig> = {}
): { batchIndex: number; size: number; sendAt: Date }[] {
  const batchSize = config.batchSize ?? DEFAULT_BATCH_SIZE;
  const batchDelayMs = config.batchDelayMs ?? DEFAULT_BATCH_DELAY_MS;
  const todayCapacity = config.dailyLimit
    ? Math.min(
        recipientCount,
        Math.max(0, config.dailyLimit - (config.usedToday ?? 0))
      )
    : recipientCount;

  const batches: { batchIndex: number; size: number; sendAt: Date }[] = [];
  let remaining = todayCapacity;

  for (let i = 0; remaining > 0; i++) {
    const size = Math.min(remaining, batchSize);
    const sendAt = new Date(Date.now() + i * batchDelayMs);
    batches.push({ batchIndex: i, size, sendAt });
    remaining -= size;
  }

  return batches;
}

/**
 * Estimate the current daily usage from sent broadcasts today.
 */
export async function estimateDailyUsage(
  getSentCountToday: () => Promise<number>
): Promise<number> {
  try {
    return await getSentCountToday();
  } catch {
    return 0;
  }
}
