'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ImageDropzone } from '@/components/collections/image-dropzone';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ImageEntry {
  file: File;
  preview: string;
  caption?: string;
  sort_order: number;
}

export default function NewCollectionPage() {
  const router = useRouter();
  const t = useTranslations('Collections.new');
  const { accountId } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      toast.error(t('toastNameRequired'));
      return;
    }
    if (!accountId) {
      toast.error(t('toastNotLinked'));
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      toast.error(t('toastNotSignedIn'));
      setSaving(false);
      return;
    }

    try {
      const { data: collection, error: cErr } = await supabase
        .from('collections')
        .insert({
          account_id: accountId,
          user_id: user.id,
          name: name.trim(),
          description: description.trim() || null,
          status: 'draft',
        })
        .select()
        .single();

      if (cErr || !collection)
        throw cErr ?? new Error('Failed to create collection');

      // Upload images
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const ext = img.file.name.split('.').pop() ?? 'jpg';
        const filePath = `collections/${collection.id}/${i}-${Date.now()}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from('collection-images')
          .upload(filePath, img.file);

        if (uploadErr) {
          toast.error(t('toastUploadFailed', { error: uploadErr.message }));
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('collection-images')
          .getPublicUrl(filePath);

        const { error: imgErr } = await supabase
          .from('collection_images')
          .insert({
            collection_id: collection.id,
            image_url: urlData?.publicUrl ?? filePath,
            sort_order: img.sort_order,
            caption: img.caption || null,
          });

        if (imgErr) {
          toast.error(t('toastImageSaveFailed', { error: imgErr.message }));
        }
      }

      toast.success(t('toastSaved'));
      router.push(`/collections/${collection.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  function addImages(files: File[]) {
    const newEntries: ImageEntry[] = files.map((file, i) => ({
      file,
      preview: URL.createObjectURL(file),
      caption: '',
      sort_order: images.length + i,
    }));
    setImages((prev) => [...prev, ...newEntries]);
  }

  function removeImage(index: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  function updateCaption(index: number, caption: string) {
    setImages((prev) =>
      prev.map((img, i) => (i === index ? { ...img, caption } : img))
    );
  }

  function reorderImages(dragIndex: number, dropIndex: number) {
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(dropIndex, 0, moved);
      return next.map((img, i) => ({ ...img, sort_order: i }));
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
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
          <h1 className="text-foreground text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t('subtitle')}</p>
        </div>
      </div>

      <div className="border-border bg-card space-y-6 rounded-xl border p-6">
        <div className="space-y-2">
          <Label htmlFor="name">{t('nameLabel')}</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('namePlaceholder')}
            className="border-border bg-muted text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">{t('descriptionLabel')}</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('descriptionPlaceholder')}
            rows={3}
            className="border-border bg-muted text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <div className="space-y-3">
          <Label>{t('imagesLabel')}</Label>
          <ImageDropzone
            onDrop={addImages}
            images={images}
            onRemove={removeImage}
            onCaptionChange={updateCaption}
            onReorder={reorderImages}
          />
        </div>
      </div>

      <div className="border-border flex items-center justify-between border-t pt-4">
        <Button
          variant="outline"
          onClick={() => router.push('/collections')}
          className="border-border text-muted-foreground"
        >
          {t('cancel')}
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="mr-2 h-4 w-4" />
          {t('save')}
        </Button>
      </div>
    </div>
  );
}
