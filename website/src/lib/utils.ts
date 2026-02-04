export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  } catch {
    return dateStr;
  }
}

export function formatDateRange(startDate: string | null, endDate: string | null): string {
  if (!startDate && !endDate) return '';
  if (!startDate) return formatDate(endDate);
  if (!endDate) return formatDate(startDate);
  return `${formatDate(startDate)} — ${formatDate(endDate)}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[áàâä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i')
    .replace(/[óòôö]/g, 'o')
    .replace(/[úùûü]/g, 'u')
    .replace(/[ýÿ]/g, 'y')
    .replace(/[ðþ]/g, 'd')
    .replace(/[æ]/g, 'ae')
    .replace(/[ø]/g, 'o')
    .replace(/[ß]/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getImagePath(localPath: string | null, originalUrl: string): string {
  if (localPath) {
    // Convert local path to public path
    // localPath is like "images/2025/555/filename.jpg"
    return `/${localPath}`;
  }
  return originalUrl;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
