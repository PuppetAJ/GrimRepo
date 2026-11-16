const SENTENCE_BREAK = /(?<=[.!?])\s+(?=[A-Z0-9"'(])/

const JOIN_BELOW_CHARS = 16

export function Sentences({ text }: { text: string }) {
  const lines: string[] = []
  for (const sentence of text.split(SENTENCE_BREAK))
    if (lines.length && sentence.length < JOIN_BELOW_CHARS) lines[lines.length - 1] += ` ${sentence}`
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
