'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, X, GripVertical } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ImageEntry {
  file: File;
  preview: string;
  caption?: string;
  sort_order: number;
}

interface ImageDropzoneProps {
  onDrop: (files: File[]) => void;
  images: ImageEntry[];
  onRemove: (index: number) => void;
  onCaptionChange: (index: number, caption: string) => void;
  onReorder: (dragIndex: number, dropIndex: number) => void;
}

export function ImageDropzone({
  onDrop,
  images,
  onRemove,
  onCaptionChange,
  onReorder,
}: ImageDropzoneProps) {
  const t = useTranslations('Collections.imageDropzone');
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith('image/')
      );
      if (files.length > 0) onDrop(files);
    },
    [onDrop]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []).filter((f) =>
        f.type.startsWith('image/')
      );
      if (files.length > 0) onDrop(files);
      if (inputRef.current) inputRef.current.value = '';
    },
    [onDrop]
  );

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
          dragOver
            ? 'border-primary bg-primary/5'
            : 'border-border bg-muted/30 hover:border-border hover:bg-muted/50'
        }`}
      >
        <Upload className="text-muted-foreground mb-2 h-8 w-8" />
        <p className="text-foreground text-sm font-medium">{t('dropHint')}</p>
        <p className="text-muted-foreground mt-1 text-xs">
          {t('acceptedFormats')}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />
      </div>

      {/* Image previews */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img, index) => (
            <div
              key={index}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null && dragIndex !== index) {
                  onReorder(dragIndex, index);
                }
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className="group border-border bg-card relative overflow-hidden rounded-xl border"
            >
              <div className="aspect-[3/4] overflow-hidden">
                <img
                  src={img.preview}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Drag handle */}
              <div className="bg-background/60 absolute top-1 left-1 flex h-6 w-6 items-center justify-center rounded-md opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                <GripVertical className="text-foreground h-3.5 w-3.5" />
              </div>

              {/* Remove button */}
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-md bg-red-500/80 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:bg-red-500"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              {/* Caption input */}
              <div className="absolute right-0 bottom-0 left-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                <input
                  type="text"
                  value={img.caption ?? ''}
                  onChange={(e) => onCaptionChange(index, e.target.value)}
                  placeholder={t('captionPlaceholder')}
                  className="w-full rounded-md border-0 bg-transparent px-1.5 py-1 text-xs text-white placeholder:text-white/50 focus:ring-1 focus:ring-white/30 focus:outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Sort badge */}
              <div className="bg-background/70 text-foreground absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-xs font-medium backdrop-blur-sm">
                #{img.sort_order + 1}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
