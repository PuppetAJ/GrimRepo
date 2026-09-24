import naughtyWords from 'naughty-words/en.json' with { type: 'json' }
import { DataSet, englishDataset, englishRecommendedTransformers, parseRawPattern, RegExpMatcher } from 'obscenity'

// Playground words the published lists leave out, in the matcher's syntax: | marks where a word must start or end.
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
// Entries in the broad list that are harmless in a name, or fold into common words ('butt' reads as 'but').
const HARMLESS = new Set(['xx', 'xxx', 'sm', 'scat', 'escort', 'butt', 'dommes', 'domination', 'skeet', 'fingering'])
// Ordinary words the looser patterns below would otherwise catch.
const WHITELIST = ['shiitake', 'twinkl', 'rapping', 'coonskin', 'glovemaking']

// Long words match anywhere, middling ones must start a word, and short ones must be whole words.
const pattern = (word: string) => (word.length >= 8 ? word : word.length >= 5 ? `|${word}` : `|${word}|`)

// The matcher folds doubled letters in names before comparing, so the patterns are folded the same way.
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

// Names that would pass for the game, the site or its staff, compared without case or underscores.
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

/** Profanity, including when its letters are split up with underscores or it hides in camelCase or among digits. */
export function isOffensive(name: string): boolean {
  // The matcher counts underscores as letters, so word edges come from spaces.
  const spaced = name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^\d+|\d+$/g, ' ')
    .replaceAll('_', ' ')
  return [name, name.replaceAll('_', ''), spaced].some((reading) => matcher.hasMatch(reading))
}

export const isReserved = (name: string): boolean => RESERVED.has(name.replaceAll('_', '').toLowerCase())
