const BREAK = /(?<=[.!?])\s+(?=[A-Z0-9"'(])/

const SHORT = 16

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
