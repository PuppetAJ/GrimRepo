import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { logLines, MONITOR_COLUMNS, MONITOR_ROWS, wrap } from './monitorLines.ts'

describe("the monitor's console", () => {
  it('wraps a long line at spaces, indenting what carries over', () => {
    const rows = wrap('> You hit me for 5. You lead by 21. RNG carried you again.', 24)
    assert.ok(rows.every((row) => row.length <= 24))
    assert.deepEqual(rows, ['> You hit me for 5. You', '  lead by 21. RNG', '  carried you again.'])
  })

  it('keeps only the rows that fit, newest last', () => {
    const log = Array.from({ length: 12 }, (_, index) => `P03> Line ${index} ${'and on '.repeat(8)}`)
    const lines = logLines(log, MONITOR_ROWS - 1, MONITOR_COLUMNS)
    assert.equal(lines.length, MONITOR_ROWS)
    assert.equal(lines[0], '// P03 CONSOLE')
    assert.ok(lines.every((line) => line.length <= MONITOR_COLUMNS))
    assert.ok(lines.at(-1)?.startsWith('  '), 'the last row is the end of the newest line')
  })

  it('leaves lines whole without columns, for the reader that wraps them itself', () => {
    const long = `P03> ${'word '.repeat(20)}`
    assert.equal(logLines([long])[1], long.replace('P03> ', '> '))
  })
})
