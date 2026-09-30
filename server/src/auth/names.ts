import naughtyWords from 'naughty-words/en.json' with { type: 'json' }
import { DataSet, englishDataset, englishRecommendedTransformers, parseRawPattern, RegExpMatcher } from 'obscenity'

// Words the published lists miss; | marks a required word edge.
const CHILDISH = [
  '|balls',
  'hemorrhoid',
  '|peepee',
  '|weewee',
  '|pee|',
  '|poop',
  '|poo|',
  '|caca|',
  '|doodoo',
  '|turd|',
  '|turds|',
  '|fart|',
  '|farts|',
  '|farting',
  'butthole',
  'buttcrack',
  'diarrhea',
]
// Harmless in a name, or they fold into common words ('butt' reads as 'but').
const HARMLESS = new Set(['xx', 'xxx', 'sm', 'scat', 'escort', 'butt', 'dommes', 'domination', 'skeet', 'fingering'])
// Ordinary words the looser patterns would otherwise catch.
const WHITELIST = ['shiitake', 'twinkl', 'rapping', 'coonskin', 'glovemaking']

// Shorter words need stricter word edges, or they flag ordinary names.
const pattern = (word: string) => (word.length >= 8 ? word : word.length >= 5 ? `|${word}` : `|${word}|`)

// The matcher folds doubled letters, so patterns must be folded the same way.
const fold = (text: string) => text.replace(/([^beolsg])\1+/g, '$1').replace(/([beolsg])\1{2,}/g, '$1$1')

const broad = new Set(naughtyWords.map((word) => word.toLowerCase().replace(/[^a-z0-9]/g, '')))
const patterns = new Set([
  ...[...broad]
    .filter((word) => !HARMLESS.has(word))
    .map(fold)
    .filter((word) => word.length > 1)
    .map(pattern),
  ...CHILDISH.map(fold),
])
const dataset = new DataSet<{ originalWord?: string }>().addAll(englishDataset)
for (const raw of patterns) dataset.addPhrase((phrase) => phrase.addPattern(parseRawPattern(raw)))
const built = dataset.build()
const matcher = new RegExpMatcher({
  ...built,
  whitelistedTerms: [...(built.whitelistedTerms ?? []), ...WHITELIST],
  ...englishRecommendedTransformers,
})

// Names that could pass for the game, the site or its staff.
const RESERVED = new Set([
  'p03',
  'admin',
  'administrator',
  'grimrepo',
  'moderator',
  'mod',
  'staff',
  'support',
  'official',
  'system',
  'root',
  'leshy',
  'demo',
  'guest',
  'anonymous',
  'deleted',
  'null',
  'undefined',
])

export const NAME_REFUSED = 'That name is not allowed. Pick another.'

/** Also catches words split by underscores or hidden in camelCase or digits. */
export function isOffensive(name: string): boolean {
  // The matcher counts underscores as letters, so word edges come from spaces.
  const spaced = name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^\d+|\d+$/g, ' ')
    .replaceAll('_', ' ')
  return [name, name.replaceAll('_', ''), spaced].some((reading) => matcher.hasMatch(reading))
}

// guest_ names are for guests only, so no player can pass for one.
export const isReserved = (name: string): boolean =>
  RESERVED.has(name.replaceAll('_', '').toLowerCase()) || /^guest_/i.test(name)
