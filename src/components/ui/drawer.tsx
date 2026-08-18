'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

import { cn } from '@/lib/cn';

/**
 * A side panel. It enters from the inline-start edge, so it slides from the left in
 * French and from the right in Arabic without a direction-specific rule (ADR-029).
 *
 * Used by the shell for the mobile navigation, and by detail views later.
 */
export function Drawer({
  trigger,
  title,
  children,
  closeLabel,
  open,
  onOpenChange,
  className,
}: {
  trigger?: React.ReactNode;
  title: string;
  children: React.ReactNode;
  closeLabel: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30" />
        <Dialog.Content
          className={cn(
            'fixed inset-y-0 start-0 w-[min(20rem,85vw)] overflow-y-auto border-e border-(--border) bg-(--surface) shadow-lg',
            className,
          )}
        >
          <VisuallyHidden asChild>
            <Dialog.Title>{title}</Dialog.Title>
          </VisuallyHidden>
          <Dialog.Close
            aria-label={closeLabel}
            className="text-text-dim hover:text-text absolute end-3 top-3 rounded p-1"
          >
            <span aria-hidden>✕</span>
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
