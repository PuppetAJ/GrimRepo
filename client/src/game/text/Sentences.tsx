/** A sentence ends at . ! or ? before a space and a capital, a digit or a quote, so "Ctrl+Z:" or "1.5" stay whole. */
const BREAK = /(?<=[.!?])\s+(?=[A-Z0-9"'(])/

/** P03's lines with each sentence on a line of its own, so none trails onto the next. */
export function Sentences({ text }: { text: string }) {
  return (
    <>
      {text.split(BREAK).map((sentence, index) => (
        <span key={index} className="block">
          {sentence}
        </span>
      ))}
    </>
  )
}
