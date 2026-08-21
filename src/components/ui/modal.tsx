'use client';

import * as Dialog from '@radix-ui/react-dialog';

import { cn } from '@/lib/cn';

/**
 * A modal dialog. Focus trapping, restoration, Escape handling and the overlay's
 * inert-ness come from Radix; only the surface is ours.
 *
 * The open and close animations are driven by Radix's `data-state` attribute rather than
 * by a JavaScript engine. Radix keeps the element mounted until its CSS animation
 * finishes, so a keyframe here is enough — reaching for Framer Motion would mean fighting
 * the primitive over who controls unmounting, for an effect CSS already does.
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
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 bg-black/30',
            'data-[state=open]:animate-[modal-overlay-in_var(--duration-base)_var(--ease-out)]',
            'motion-reduce:animate-none',
          )}
        />
        <Dialog.Content
          className={cn(
            'fixed top-1/2 left-1/2 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2',
            'rounded-(--radius) border border-(--border) bg-(--surface) p-6 shadow-lg',
            'data-[state=open]:animate-[modal-content-in_var(--duration-base)_var(--ease-out)]',
            'motion-reduce:animate-none',
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
