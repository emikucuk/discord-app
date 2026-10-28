function stripHtml(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<li>/gi, '\n')
    .replace(/<\/li>/gi, '')
    .replace(/<strong>/gi, '')
    .replace(/<\/strong>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\r/g, '')
    .trim();
}

const FIELD_PATTERNS = [
  { key: 'OS', re: /^(?:işletim\s*sistemi|os|operating\s*system)\s*\*?\s*:?\s*(.+)$/i },
  { key: 'CPU', re: /^(?:işlemci|processor|cpu)\s*\*?\s*:?\s*(.+)$/i },
  { key: 'RAM', re: /^(?:bellek|memory|ram)\s*\*?\s*:?\s*(.+)$/i },
  { key: 'GPU', re: /^(?:ekran\s*kartı|graphics|gpu|video\s*card|video)\s*\*?\s*:?\s*(.+)$/i },
  { key: 'Depolama', re: /^(?:depolama|storage|hard\s*disk|free\s*disk|disk\s*space)\s*\*?\s*:?\s*(.+)$/i },
];

function parseReqBlock(rawHtml) {
  const text = stripHtml(rawHtml)
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]{2,}/g, ' ');

  const lines = text
    .split('\n')
    .map((l) => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean)
    .filter((l) => {
      const low = l.toLocaleLowerCase('tr-TR');
      return low !== 'minimum:' && low !== 'minimum' && low !== 'recommended:' && low !== 'önerilen:' && low !== 'önerilen';
    });

  const picked = {};
  for (const line of lines) {
    // JS /i Türkçe İ harfini düzgün katlamaz; tr-TR lower ile eşleştir
    const low = line.toLocaleLowerCase('tr-TR');
    for (const { key, re } of FIELD_PATTERNS) {
      const m = low.match(re);
      if (m && !picked[key]) {
        // Orijinal satırdan değeri kes: ilk ':' sonrası
        const colon = line.indexOf(':');
        const value =
          colon >= 0
            ? line.slice(colon + 1).trim()
            : m[1].replace(/\s*\*\s*$/, '').trim();
        if (value) picked[key] = value;
      }
    }
  }

  const order = ['OS', 'CPU', 'RAM', 'GPU', 'Depolama'];
  const compact =
    Object.keys(picked).length > 0
      ? order
          .filter((k) => picked[k])
          .map((k) => `${k}: ${picked[k]}`)
          .join('\n')
      : lines.slice(0, 4).join('\n') || null;

  return { compact, raw: text, picked };
}

/**
 * Discord alanı için kısa gereksinim özeti (boş satır yok).
 */
export function buildRequirementsSummary({ minimumHtml, recommendedHtml }) {
  const min = parseReqBlock(minimumHtml || '');
  const rec = parseReqBlock(recommendedHtml || '');

  // Önerilen alanları esas al; eksikleri minimumdan tamamla
  const order = ['OS', 'CPU', 'RAM', 'GPU', 'Depolama'];
  const merged = {};
  for (const key of order) {
    merged[key] = rec.picked?.[key] || min.picked?.[key] || null;
  }
  const body = order
    .filter((k) => merged[k])
    .map((k) => `${k}: ${merged[k]}`)
    .join('\n') || rec.compact || min.compact;

  if (!body) {
    return { requirementsField: null };
  }

  return {
    requirementsField: `${body}`.slice(0, 1024),
  };
}
