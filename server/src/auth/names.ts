import { englishDataset, englishRecommendedTransformers, RegExpMatcher } from 'obscenity'

const matcher = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers })

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

/** Profanity, including when its letters are split up with underscores. */
export function isOffensive(name: string): boolean {
  return matcher.hasMatch(name) || matcher.hasMatch(name.replaceAll('_', ''))
}

export const isReserved = (name: string): boolean => RESERVED.has(name.replaceAll('_', '').toLowerCase())
