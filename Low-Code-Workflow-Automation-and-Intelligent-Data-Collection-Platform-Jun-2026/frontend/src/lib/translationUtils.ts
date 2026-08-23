import { translationsApi } from './apiModules'

export interface TranslatedFormContent {
  title?: string
  description?: string | null
}

export async function loadFormTranslations(
  formIds: number[],
  lang: string,
): Promise<Record<number, TranslatedFormContent>> {
  const language = lang.split('-')[0]
  if (language === 'en') return {}
  const uniqueIds = Array.from(new Set(formIds.filter(id => typeof id === 'number' && id > 0)))
  if (uniqueIds.length === 0) return {}

  const results = await Promise.allSettled(uniqueIds.map(async (id) => {
    const data = await translationsApi.getPublic(id, language)
    return { id, content: data.content }
  }))

  return results.reduce<Record<number, TranslatedFormContent>>((acc, result) => {
    if (result.status !== 'fulfilled') return acc
    const { id, content } = result.value
    if (!content) return acc
    acc[id] = {
      title: typeof content.title === 'string' ? content.title : undefined,
      description: typeof content.description === 'string' ? content.description : undefined,
    }
    return acc
  }, {})
}
