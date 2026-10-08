/** A sentence ends at . ! or ? before a space and a capital, a digit or a quote, so "Ctrl+Z:" or "1.5" stay whole. */
const BREAK = /(?<=[.!?])\s+(?=[A-Z0-9"'(])/

/** A sentence this short stays on the line before, so a quip like "One use." doesn't stand alone. */
const SHORT = 16

/** P03's lines with each sentence on a line of its own, short ones kept with the one before, so none trails onto the next. */
export function Sentences({ text }: { text: string }) {
  const lines: string[] = []
  for (const sentence of text.split(BREAK))
    if (lines.length && sentence.length < SHORT) lines[lines.length - 1] += ` ${sentence}`
    else lines.push(sentence)
  return (
    <>
      {lines.map((line, index) => (
        <span key={index} className="block">
          {line}
        </span>
      ))}
    </>
  )
}
