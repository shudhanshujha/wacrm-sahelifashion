'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Collection,
  CollectionImage,
  MessageTemplate,
  Broadcast,
} from '@/types';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Loader2,
  Send,
  Trash2,
  Radio,
  Image as ImageIcon,
  BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/use-auth';

const statusConfig: Record<string, { label: string; classes: string }> = {
  draft: {
    label: 'draft',
    classes: 'bg-slate-500/10 text-muted-foreground border-slate-500/20',
  },
  sent: {
    label: 'sent',
    classes: 'bg-primary/10 text-primary border-primary/20',
  },
  archived: {
    label: 'archived',
    classes: 'bg-red-500/10 text-red-400 border-red-500/20',
  },
};

export default function CollectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('Collections.detail');
  const tStatus = useTranslations('Collections.status');
  const { accountId } = useAuth();
  const collectionId = params.id as string;

  const [collection, setCollection] = useState<Collection | null>(null);
  const [images, setImages] = useState<CollectionImage[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [sending, setSending] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: col, error: colErr } = await supabase
        .from('collections')
        .select('*')
        .eq('id', collectionId)
        .single();
      if (colErr) throw colErr;
      setCollection(col);

      const { data: imgs } = await supabase
        .from('collection_images')
        .select('*')
        .eq('collection_id', collectionId)
        .order('sort_order', { ascending: true });
      setImages(imgs ?? []);

      const { data: bcs } = await supabase
        .from('broadcasts')
        .select('*')
        .eq('collection_id', collectionId)
        .order('created_at', { ascending: false });
      setBroadcasts(bcs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('notFound'));
    } finally {
      setLoading(false);
    }
  }, [collectionId, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleDelete() {
    setDeleting(true);
    const supabase = createClient();
    const { error: delErr } = await supabase
      .from('collections')
      .delete()
      .eq('id', collectionId);
    setDeleting(false);
    if (delErr) {
      toast.error(t('toastFailedDelete', { error: delErr.message }));
      return;
    }
    toast.success(t('toastDeleted'));
    router.push('/collections');
  }

  async function openSendDialog() {
    const supabase = createClient();
    const { data } = await supabase
      .from('message_templates')
      .select('*')
      .eq('status', 'APPROVED')
      .order('created_at', { ascending: false });
    setTemplates(data ?? []);
    setShowSendDialog(true);
  }

  async function handleSendBroadcast() {
    if (!selectedTemplate || !collection) return;
    setSending(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user || !accountId) throw new Error('Not authenticated');

      const template = templates.find((t) => t.id === selectedTemplate);
      if (!template) throw new Error('Template not found');

      // Build template variables from collection data
      const variables: Record<string, { type: 'static'; value: string }> = {};
      const firstImage = images[0];

      // Auto-map {{1}} = collection name, {{2}} = description
      variables['1'] = { type: 'static', value: collection.name };
      if (collection.description) {
        variables['2'] = { type: 'static', value: collection.description };
      }

      const broadcastPayload = {
        name: `Collection: ${collection.name}`,
        template,
        audience: { type: 'all' as const },
        variables,
        headerMediaUrl: firstImage?.image_url ?? '',
        collectionId: collection.id,
      };

      // Create broadcast directly with collection link
      const { data: broadcast, error: bErr } = await supabase
        .from('broadcasts')
        .insert({
          user_id: user.id,
          account_id: accountId,
          name: broadcastPayload.name,
          template_name: template.name,
          template_language: template.language ?? 'en_US',
          template_variables: variables,
          audience_filter: { type: 'all' },
          collection_id: collection.id,
          status: 'draft',
          total_recipients: 0,
          sent_count: 0,
          delivered_count: 0,
          read_count: 0,
          replied_count: 0,
          failed_count: 0,
          opted_out_count: 0,
        })
        .select()
        .single();

      if (bErr || !broadcast)
        throw bErr ?? new Error('Failed to create broadcast');

      toast.success(t('toastBroadcastCreated'));
      router.push(`/broadcasts/${broadcast.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to create broadcast'
      );
    } finally {
      setSending(false);
      setShowSendDialog(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-primary h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-red-400">{error ?? t('notFound')}</p>
        <Button variant="outline" onClick={() => router.push('/collections')}>
          {t('backToCollections')}
        </Button>
      </div>
    );
  }

  const cfg = statusConfig[collection.status] ?? statusConfig.draft;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push('/collections')}
            className="border-border"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-foreground text-2xl font-bold">
                {collection.name}
              </h1>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.classes}`}
              >
                {tStatus(cfg.label)}
              </span>
            </div>
            {collection.description && (
              <p className="text-muted-foreground mt-1 text-sm">
                {collection.description}
              </p>
            )}
            <p className="text-muted-foreground mt-1 text-xs">
              {t('createdAt', {
                date: new Date(collection.created_at).toLocaleDateString(),
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {collection.status === 'draft' && (
            <Button
              onClick={openSendDialog}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Send className="mr-2 h-4 w-4" />
              {t('sendBroadcast')}
            </Button>
          )}
          {confirmDelete ? (
            <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm">
              <span className="text-red-300">{t('deletePrompt')}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="border-border text-muted-foreground hover:bg-muted h-7 bg-transparent"
              >
                {t('cancel')}
              </Button>
              <Button
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
                className="h-7 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? t('deleting') : t('confirm')}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              className="border-red-500/30 bg-transparent text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              {t('delete')}
            </Button>
          )}
        </div>
      </div>

      {/* Image Gallery */}
      {images.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img) => (
            <div
              key={img.id}
              className="group border-border bg-card relative overflow-hidden rounded-xl border"
            >
              <div className="aspect-[3/4] overflow-hidden">
                <img
                  src={img.image_url}
                  alt={img.caption ?? ''}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              {img.caption && (
                <div className="absolute right-0 bottom-0 left-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                  <p className="text-xs font-medium text-white">
                    {img.caption}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="border-border bg-card flex h-48 flex-col items-center justify-center rounded-xl border">
          <ImageIcon className="text-muted-foreground mb-2 h-8 w-8" />
          <p className="text-muted-foreground text-sm">{t('noImages')}</p>
        </div>
      )}

      {/* Broadcast History */}
      {broadcasts.length > 0 && (
        <div className="border-border bg-card rounded-xl border p-4">
          <h3 className="text-foreground mb-4 flex items-center gap-2 text-sm font-medium">
            <BarChart3 className="text-primary h-4 w-4" />
            {t('broadcastHistory')}
          </h3>
          <div className="space-y-2">
            {broadcasts.map((bc) => {
              const total = bc.total_recipients || 1;
              const deliveredPct = Math.round(
                (bc.delivered_count / total) * 100
              );
              const readPct = Math.round((bc.read_count / total) * 100);
              return (
                <div
                  key={bc.id}
                  className="border-border bg-muted/30 hover:bg-muted/50 flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 transition-colors"
                  onClick={() => router.push(`/broadcasts/${bc.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <Radio className="text-muted-foreground h-4 w-4" />
                    <div>
                      <p className="text-foreground text-sm font-medium">
                        {bc.name}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {new Date(bc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-muted-foreground flex items-center gap-4 text-xs">
                    <span>{t('sentCount', { count: bc.sent_count })}</span>
                    <span>{t('deliveredPct', { pct: deliveredPct })}</span>
                    <span>{t('readPct', { pct: readPct })}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Send Broadcast Dialog */}
      {showSendDialog && (
        <div className="bg-background/70 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="border-border bg-card w-full max-w-md rounded-xl border p-6 shadow-lg">
            <h3 className="text-foreground text-lg font-semibold">
              {t('sendDialog.title')}
            </h3>
            <p className="text-muted-foreground mt-1 text-sm">
              {t('sendDialog.subtitle')}
            </p>

            {templates.length === 0 ? (
              <p className="mt-4 text-sm text-red-400">
                {t('sendDialog.noTemplates')}
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {templates.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    onClick={() => setSelectedTemplate(tmpl.id)}
                    className={`w-full rounded-lg border p-3 text-left transition-all ${
                      selectedTemplate === tmpl.id
                        ? 'border-primary bg-primary/5 ring-primary/30 ring-1'
                        : 'border-border bg-muted/30 hover:border-border'
                    }`}
                  >
                    <p className="text-foreground text-sm font-medium">
                      {tmpl.name}
                    </p>
                    <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                      {tmpl.body_text}
                    </p>
                  </button>
                ))}
              </div>
            )}

            <div className="border-border mt-6 flex items-center justify-between border-t pt-4">
              <Button
                variant="outline"
                onClick={() => setShowSendDialog(false)}
                className="border-border text-muted-foreground"
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={handleSendBroadcast}
                disabled={!selectedTemplate || sending}
                className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Send className="mr-2 h-4 w-4" />
                {t('sendDialog.createBroadcast')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
