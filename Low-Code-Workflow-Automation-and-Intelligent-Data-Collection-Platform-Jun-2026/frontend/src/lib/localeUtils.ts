export const DIGIT_MAPS: Record<string, string[]> = {
  // mapping 0-9 for supported languages
  hi: ['०','१','२','३','४','५','६','७','८','९'],
  mr: ['०','१','२','३','४','५','६','७','८','९'],
  bn: ['০','১','২','৩','৪','৫','৬','৭','৮','৯'],
  ta: ['௦','௧','௨','௩','௪','௫','௬','௭','௮','௯'],
  te: ['౦','౧','౨','౩','౪','౫','౬','౭','౮','౯'],
  kn: ['೦','೧','೨','೩','೪','೫','೬','೭','೮','೯'],
  gu: ['૦','૧','૨','૩','૪','૫','૬','૭','૮','૯'],
  pa: ['੦','੧','੨','੩','੪','੫','੬','੭','੮','੯'],
  ml: ['൦','൧','൨','൩','൪','൫','൬','൭','൮','൯'],
  ur: ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹']
}

export function formatNumber(n: number | string, lang = 'en') {
  const num = typeof n === 'number' ? n : Number(n)
  if (Number.isNaN(num)) return String(n)
  const base = String(num)
  const langCode = (lang || 'en').split('-')[0]
  const map = DIGIT_MAPS[langCode]
  if (!map) return base.toLocaleString()
  // convert each digit
  return base.replace(/\d/g, (d) => map[Number(d)])
}

export function formatDateLocal(d: Date | string, lang = 'en', options?: Intl.DateTimeFormatOptions) {
  const date = typeof d === 'string' ? new Date(d) : d
  try {
    return new Intl.DateTimeFormat(lang, options).format(date)
  } catch (e) {
    return date.toLocaleString()
  }
}

export function timeAgo(date: Date | string, lang = 'en') {
  const dt = typeof date === 'string' ? new Date(date) : date
  const diff = (Date.now() - dt.getTime()) / 1000
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
  if (diff < 60) return rtf.format(Math.round(-diff), 'second')
  if (diff < 3600) return rtf.format(Math.round(-diff/60), 'minute')
  if (diff < 86400) return rtf.format(Math.round(-diff/3600), 'hour')
  if (diff < 2592000) return rtf.format(Math.round(-diff/86400), 'day')
  if (diff < 31104000) return rtf.format(Math.round(-diff/2592000), 'month')
  return rtf.format(Math.round(-diff/31104000), 'year')
}
