import { Choices, P03Dialogue } from '../game/P03Dialogue.tsx'

// A mockup: the end box with its bottom-left corner cut, so the slant lives on the box and the stick stays straight.
const CUT =
  '[&>section]:[clip-path:polygon(0_-2rem,100%_-2rem,100%_100%,1.25rem_100%,0_calc(100%-1.25rem))] [&>section]:[background:linear-gradient(45deg,transparent_calc(50%-1.5px),var(--p03-edge)_calc(50%-1.5px)_calc(50%+1.5px),transparent_calc(50%+1.5px))_left_bottom/1.25rem_1.25rem_no-repeat_border-box,var(--p03-ground)] [&>section]:rounded-bl-none'

const ENDINGS = [
  {
    face: 'whiteflag' as const,
    words: 'Fine. You know the rules. Now a real game, where it actually counts.',
    choices: ['Start a run', 'Play tutorial again'],
  },
  { face: 'whiteflag' as const, words: 'The boss is down. Localhost is cleared.', choices: ['Claim the reward'] },
]

export function CornerOption() {
  return (
    <div className="flex flex-wrap items-start gap-8 rounded-md bg-[#07130b] p-8">
      {[28, 21].map((rem) =>
        ENDINGS.map((ending) => (
          <div key={`${rem}-${ending.words}`} style={{ width: `${rem}rem` }} className="max-w-full">
            <P03Dialogue
              face={ending.face}
              className={CUT}
              ledge={<Choices choices={ending.choices.map((label) => ({ label, onChoose: () => {} }))} />}
            >
              <p>{ending.words}</p>
            </P03Dialogue>
          </div>
        )),
      )}
    </div>
  )
}
