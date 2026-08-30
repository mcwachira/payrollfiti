/**
 * Renders a JSON-LD structured-data block. `data` is attacker-controlled
 * only in the sense that it's server-rendered content we constructed
 * ourselves (page copy, FAQ text, blog post fields) — never raw user input
 * — so a plain JSON.stringify is safe here without HTML-escaping.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}