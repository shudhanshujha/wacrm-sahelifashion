import type { SupabaseClient } from '@supabase/supabase-js';

export interface CollectionAnalytics {
  collectionId: string;
  totalBroadcasts: number;
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalReplied: number;
  totalFailed: number;
  totalOptedOut: number;
  totalRecipients: number;
}

/**
 * Aggregate broadcast analytics for a given collection.
 * Rolls up counts from all linked broadcasts.
 */
export async function getCollectionAnalytics(
  db: SupabaseClient,
  accountId: string,
  collectionId: string
): Promise<CollectionAnalytics> {
  const { data: broadcasts, error } = await db
    .from('broadcasts')
    .select('*')
    .eq('account_id', accountId)
    .eq('collection_id', collectionId);

  if (error) {
    throw new Error(`Failed to fetch collection analytics: ${error.message}`);
  }

  const analytics: CollectionAnalytics = {
    collectionId,
    totalBroadcasts: broadcasts?.length ?? 0,
    totalSent: 0,
    totalDelivered: 0,
    totalRead: 0,
    totalReplied: 0,
    totalFailed: 0,
    totalOptedOut: 0,
    totalRecipients: 0,
  };

  for (const bc of broadcasts ?? []) {
    analytics.totalSent += bc.sent_count ?? 0;
    analytics.totalDelivered += bc.delivered_count ?? 0;
    analytics.totalRead += bc.read_count ?? 0;
    analytics.totalReplied += bc.replied_count ?? 0;
    analytics.totalFailed += bc.failed_count ?? 0;
    analytics.totalOptedOut += bc.opted_out_count ?? 0;
    analytics.totalRecipients += bc.total_recipients ?? 0;
  }

  return analytics;
}

/**
 * Get analytics for all collections in an account.
 */
export async function getAllCollectionsAnalytics(
  db: SupabaseClient,
  accountId: string
): Promise<Map<string, CollectionAnalytics>> {
  const { data: broadcasts, error } = await db
    .from('broadcasts')
    .select('*')
    .eq('account_id', accountId)
    .not('collection_id', 'is', null);

  if (error) {
    throw new Error(`Failed to fetch collection analytics: ${error.message}`);
  }

  const map = new Map<string, CollectionAnalytics>();

  for (const bc of broadcasts ?? []) {
    const cid = bc.collection_id;
    if (!cid) continue;

    if (!map.has(cid)) {
      map.set(cid, {
        collectionId: cid,
        totalBroadcasts: 0,
        totalSent: 0,
        totalDelivered: 0,
        totalRead: 0,
        totalReplied: 0,
        totalFailed: 0,
        totalOptedOut: 0,
        totalRecipients: 0,
      });
    }

    const a = map.get(cid)!;
    a.totalBroadcasts++;
    a.totalSent += bc.sent_count ?? 0;
    a.totalDelivered += bc.delivered_count ?? 0;
    a.totalRead += bc.read_count ?? 0;
    a.totalReplied += bc.replied_count ?? 0;
    a.totalFailed += bc.failed_count ?? 0;
    a.totalOptedOut += bc.opted_out_count ?? 0;
    a.totalRecipients += bc.total_recipients ?? 0;
  }

  return map;
}
