'use client';

import * as RadixTabs from '@radix-ui/react-tabs';

import { cn } from '@/lib/cn';

/**
 * Tabs on Radix: keyboard behaviour (arrow keys, Home/End, roving tabindex) and the
 * ARIA wiring come from the primitive; the appearance is ours (ADR-008).
 */
export function Tabs({
  items,
  defaultValue,
  label,
  className,
}: {
  items: { value: string; label: string; content: React.ReactNode }[];
  defaultValue?: string;
  label: string;
  className?: string;
}) {
  return (
    <RadixTabs.Root defaultValue={defaultValue ?? items[0]?.value} className={className}>
      <RadixTabs.List
        aria-label={label}
        className="flex flex-wrap gap-1 border-b border-(--border)"
      >
        {items.map((item) => (
          <RadixTabs.Trigger
            key={item.value}
            value={item.value}
            className={cn(
              'text-text-muted rounded-t-md border border-b-0 border-transparent px-3 py-2 text-[13px]',
              'hover:text-text',
              'data-[state=active]:text-gold data-[state=active]:border-(--border) data-[state=active]:bg-(--surface) data-[state=active]:font-medium',
            )}
          >
            {item.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {items.map((item) => (
        <RadixTabs.Content
          key={item.value}
          value={item.value}
          className="rounded-b-(--radius) border border-t-0 border-(--border) bg-(--surface) p-5"
        >
          {item.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
