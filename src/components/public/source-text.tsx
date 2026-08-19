/**
 * French business text shown on a page whose interface may be in another language.
 *
 * The extracted content is French and stays French until the client supplies reviewed
 * translations (ADR-025). Inside the Arabic interface that French phrase still has to
 * read left to right, or the browser's bidi algorithm moves its punctuation to the wrong
 * end — a full stop drifting to the start of the line is the visible symptom.
 *
 * Unlike `TranslatableText`, this carries no "traduction en attente" badge: that marker
 * is a message to SOFICLEF's own staff about work owed to them, and it means nothing to
 * an anonymous visitor reading the company's public presentation.
 */
export function SourceText({
  children,
  className,
  as: Tag = 'span',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'span' | 'p' | 'div';
}) {
  return (
    <Tag lang="fr" dir="ltr" className={className}>
      {children}
    </Tag>
  );
}
