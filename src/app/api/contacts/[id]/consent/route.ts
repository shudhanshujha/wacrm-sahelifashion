import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateConsentStatus } from '@/lib/contacts/consent';
import type { ConsentStatus, ConsentSource } from '@/types';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      status: ConsentStatus;
      source?: ConsentSource;
    };

    if (!body.status) {
      return NextResponse.json(
        { error: 'status is required' },
        { status: 400 }
      );
    }

    if (!['opted_in', 'not_confirmed', 'opted_out'].includes(body.status)) {
      return NextResponse.json(
        { error: 'Invalid consent status' },
        { status: 400 }
      );
    }

    const db = await createClient();

    // Verify the contact belongs to the caller's account via RLS
    const { data: contact } = await db
      .from('contacts')
      .select('id')
      .eq('id', id)
      .single();

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    await updateConsentStatus(db, {
      contactId: id,
      status: body.status,
      source: body.source,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
