import fs from 'fs'
import { yoink } from './util'

type Dump = {
  mal_id: number
  episode: number
  type: number
  start: number
  end: number
  length: number
  votes: number
  provider: string
}

const mainProviders = new Set([
  'Crunchyroll',
  '9anime',
  '9animetv',
  'Zoro',
  'animepahe',
  'AnimePahe',
  'anime-pahe',
  'Gogoanime',
  'GogoAnime',
  'gogo',
  'gogo-anime',
  'Animego',
  'NekoSama',
  'Twistmoe',
  'AnimeWorld',
  'animeworld.tv',
  'Yugen',
  'yugen',
  'yugen-anime',
  'AllAnime',
  'allanime',
  'voe',
  'Marin',
  'marin',
  'string',
  'shurizzle',
  'shurizle',
  'gojo',
  'Himitsu',
  'Intro Skipper',
  'stremio',
  'aokaze',
  'weebflow',
  'HONEYxCAT',
  'Aniworld',
  'aniworld',
  'Aniskip',
])

const fallbackProviders = new Set([
  'Animixplay',
  'AniMixPlay',
  'animixplay',
  'AnimixPlay',
  '4anime',
  'BetaCrunchyroll',
  'Manual-Submitter',
])

const blacklistedProviders = new Set(['l0f4s2', 'test', 'mal', 'TP', 'AnimePlayer', 'Inuflix'])

const unknownProviders = new Set<string>()

const typeDict: Record<string, number> = {
  op: 0,
  ed: 1,
  recap: 2,
}

const skipMap = new Map<string, Dump>()

const normalizeFloat = (raw: string) => Math.round(Number(raw) * 100) / 100

let isHeader = true

await yoink('aniskip/sanitize_db_dump', 'skip_times_public.csv').stream.eachLine(line => {
  if (isHeader) {
    isHeader = false
    return
  }

  const [malId, episode, providerName, type, _votes, start, end, length, _submitDate] = line.split(
    ',',
  ) as [string, string, string, string, string, string, string, string, string]

  if (blacklistedProviders.has(providerName)) {
    return
  }
  if (type === 'mixed-op' || type === 'mixed-ed') {
    return
  }

  if (!mainProviders.has(providerName) && !fallbackProviders.has(providerName)) {
    unknownProviders.add(providerName)
  }

  // episode .5 (ova)
  const episodeInt = parseInt(episode)
  if (episodeInt !== Number(episode)) {
    return
  }

  const key = `${malId}-${episodeInt}-${type}`

  const existing = skipMap.get(key)
  const votes = parseInt(_votes)

  if (!existing || votes > existing.votes || !fallbackProviders.has(existing.provider)) {
    skipMap.set(key, {
      mal_id: parseInt(malId),
      episode: episodeInt,
      type: typeDict[type]!,
      start: normalizeFloat(start),
      end: normalizeFloat(end),
      length: normalizeFloat(length),
      votes,
      provider: providerName,
    })
  }
})

const content = Array.from(skipMap.values())
  .sort((a, b) => a.mal_id - b.mal_id || a.episode - b.episode || a.type - b.type)
  .map(s => {
    return `${s.mal_id},${s.episode},${s.type},${s.start},${s.end},${s.length}`
  })
  .join('\n')

fs.writeFileSync('aniskip.csv', content)

const unknownProvidersFilename = 'aniskip_unknown_providers.json'

if (unknownProviders.size) {
  fs.writeFileSync(unknownProvidersFilename, JSON.stringify(Array.from(unknownProviders), null, 2))
} else {
  fs.rmSync(unknownProvidersFilename, { force: true })
}
