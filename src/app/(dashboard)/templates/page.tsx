'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { MessageTemplate } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FileText, Plus, Loader2, RefreshCw } from 'lucide-react';
import { templateStatusConfig } from '@/lib/template-status';
import { useTranslations } from 'next-intl';

export default function TemplatesPage() {
  const router = useRouter();
  const t = useTranslations('Templates');
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  async function fetchTemplates() {
    const supabase = createClient();
    const { data } = await supabase
      .from('message_templates')
      .select('*')
      .order('created_at', { ascending: false });
    setTemplates(data ?? []);
    setLoading(false);
  }

  async function syncFromMeta() {
    setSyncing(true);
    try {
      const res = await fetch('/api/whatsapp/templates/sync', {
        method: 'POST',
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? 'Sync failed');
      await fetchTemplates();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    fetchTemplates();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={syncFromMeta}
            disabled={syncing}
            className="border-border text-muted-foreground hover:bg-muted"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`}
            />
            {t('sync')}
          </Button>
          <Button
            onClick={() => router.push('/settings?tab=templates')}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('create')}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="text-primary h-6 w-6 animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <div className="border-border bg-card flex h-64 flex-col items-center justify-center rounded-xl border">
          <FileText className="text-muted-foreground mb-3 h-10 w-10" />
          <p className="text-foreground text-sm font-medium">
            {t('noTemplates')}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {t('createFirst')}
          </p>
        </div>
      ) : (
        <div className="border-border bg-card overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">
                  {t('table.name')}
                </TableHead>
                <TableHead className="text-muted-foreground hidden md:table-cell">
                  {t('table.category')}
                </TableHead>
                <TableHead className="text-muted-foreground hidden lg:table-cell">
                  {t('table.language')}
                </TableHead>
                <TableHead className="text-muted-foreground">
                  {t('table.status')}
                </TableHead>
                <TableHead className="text-muted-foreground hidden sm:table-cell">
                  {t('table.quality')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((tmpl) => {
                const cfg =
                  templateStatusConfig[tmpl.status ?? 'DRAFT'] ??
                  templateStatusConfig.DRAFT;
                const qualityLabel =
                  tmpl.quality_score === 'GREEN'
                    ? '✓'
                    : tmpl.quality_score === 'YELLOW'
                      ? '⚠'
                      : tmpl.quality_score === 'RED'
                        ? '✗'
                        : '-';
                const qualityColor =
                  tmpl.quality_score === 'GREEN'
                    ? 'text-green-400'
                    : tmpl.quality_score === 'YELLOW'
                      ? 'text-yellow-400'
                      : tmpl.quality_score === 'RED'
                        ? 'text-red-400'
                        : 'text-muted-foreground';
                return (
                  <TableRow key={tmpl.id} className="border-border">
                    <TableCell className="text-foreground font-medium">
                      {tmpl.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">
                      {tmpl.category}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden lg:table-cell">
                      {tmpl.language ?? 'en_US'}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.classes}`}
                      >
                        {cfg.label}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className={`text-xs font-medium ${qualityColor}`}>
                        {qualityLabel}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
