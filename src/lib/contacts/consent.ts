import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConsentStatus, ConsentSource } from '@/types';

export interface ConsentUpdateInput {
  contactId: string;
  status: ConsentStatus;
  source?: ConsentSource;
}

/**
 * Update a contact's consent status. Used by:
 * - The broadcast sending flow (to exclude opted-out contacts)
 * - The opt-out keyword automation handler
 * - The manual contact edit form
 */
export async function updateConsentStatus(
  db: SupabaseClient,
  input: ConsentUpdateInput
): Promise<void> {
  const update: Record<string, unknown> = {
    consent_status: input.status,
  };

  if (input.source) {
    update.consent_source = input.source;
  }

  if (input.status === 'opted_out') {
    update.opted_out_at = new Date().toISOString();
  }

  const { error } = await db
    .from('contacts')
    .update(update)
    .eq('id', input.contactId);

  if (error) {
    throw new Error(`Failed to update consent status: ${error.message}`);
  }
}

/**
 * Automatically handle opt-out keywords from inbound messages.
 * Returns true if the contact was opted out.
 */
export async function handleOptOutKeyword(
  db: SupabaseClient,
  messageText: string,
  contactId: string
): Promise<boolean> {
  const OPT_OUT_KEYWORDS = [
    'stop',
    'unsubscribe',
    'opt out',
    'बंद करो',
    'band karo',
    'nahi chahiye',
    'remove',
    'cancel',
    'quit',
  ];

  const text = messageText.toLowerCase().trim();

  const isOptOut = OPT_OUT_KEYWORDS.some((kw) => {
    // Exact match or starts with the keyword
    return text === kw || text.startsWith(kw) || text.includes(` ${kw}`);
  });

  if (!isOptOut) return false;

  await updateConsentStatus(db, {
    contactId,
    status: 'opted_out',
    source: 'opt_out_keyword',
  });

  return true;
}

/**
 * Filter out contacts who should not receive broadcasts.
 * Used in the broadcast sending flow.
 */
export function getBroadcastEligibleQuery(
  db: SupabaseClient,
  accountId: string
) {
  return db
    .from('contacts')
    .select('*')
    .eq('account_id', accountId)
    .eq('consent_status', 'opted_in');
}
