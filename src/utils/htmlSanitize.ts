/** Проверяет, есть ли в строке HTML-теги */
export function hasHtmlTags(s: string): boolean {
  return /<[a-z][\s\S]*>/i.test(s)
}

/** Удаляет опасные теги и атрибуты, оставляет базовое форматирование (b, i, u, br, p, strong, em, a, span, div, ul, ol, li) */
export function sanitizeHtml(html: string): string {
  let s = html
  s = s.replace(/<\/?(script|iframe|object|embed|form|input|button)[^>]*>/gi, '')
  s = s.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
  s = s.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '')
  s = s.replace(/href\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, 'href="#"')
  return s
}
