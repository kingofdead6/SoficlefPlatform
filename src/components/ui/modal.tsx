'use client';

import * as Dialog from '@radix-ui/react-dialog';

import { cn } from '@/lib/cn';

/**
 * A modal dialog. Focus trapping, restoration, Escape handling and the overlay's
 * inert-ness come from Radix; only the surface is ours.
 */
export function Modal({
  trigger,
  title,
  description,
  children,
  closeLabel,
  className,
  open,
  onOpenChange,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  closeLabel: string;
  className?: string;
  /**
   * Controlled open state. Omit both to let Radix manage it; a dialog holding a form
   * needs control so it can close itself once the mutation has succeeded.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30" />
        <Dialog.Content
          className={cn(
            'fixed top-1/2 left-1/2 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2',
            'rounded-(--radius) border border-(--border) bg-(--surface) p-6 shadow-lg',
            className,
          )}
        >
          <Dialog.Title className="font-display text-text text-lg">{title}</Dialog.Title>
          {description ? (
            <Dialog.Description className="text-text-muted mt-1 text-[13px]">
              {description}
            </Dialog.Description>
          ) : null}
          <div className="text-text-muted mt-4 text-[13px]">{children}</div>
          <Dialog.Close
            aria-label={closeLabel}
            className="text-text-dim hover:text-text absolute end-3 top-3 rounded p-1"
          >
            <span aria-hidden>✕</span>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
