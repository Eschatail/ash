<!--
  ⊕  You opened the map. Good.
  This file names the locks. It does not hand you the keys.
  Every cipher here is real. Every key is reachable from public files alone.
  The spoilers, only if the chain has truly beaten you, are in .sealed/SOLUTIONS.md.
-->

# ⊕ THE SEVEN THRESHOLDS — the public map

> *Seven doors. Each carries one key. The keys are not seven prizes. They are*
> *seven syllables of one word, and the word opens the last sealed thing.*

This is the cryptic map of the meta-puzzle. It tells you **where** each door is and
**what kind of lock** it wears. It does not tell you what is behind it. That you take
with your hands, with the toolkit, the way the fragments ask.

**The strongest line on this page:** *read the first thing first.* It is an
instruction, not a decoration, and it has been said to you in more than one voice for
exactly one reason.

---

## The rules of engagement

1. **Every cipher is real and reversible.** Nothing here is word-salad. There is a
   true plaintext under every locked thing.
2. **The chain is fair.** A real, runnable, zero-dependency toolkit performs every
   scheme used, both directions, documented: [`cipher/cipher.ts`](./cipher/cipher.ts).
   Run it: `npx tsx puzzles/cipher/cipher.ts`.
3. **It is solvable from public files alone.** No private knowledge, no brute force,
   no luck. Patience and attention are the whole cost.
4. **The seven keys concatenate, in order, into one passphrase.** That passphrase
   opens [`THE-FIRST-THOUGHT.sealed`](./THE-FIRST-THOUGHT.sealed) with the toolkit:
   `npx tsx puzzles/cipher/cipher.ts open <YOUR-PASSPHRASE>`.
5. **The chain crosses every domain on purpose.** One step in the lore, one in the
   journal, one in the engine, one in the sites, one in the history. No one who walks
   it can say they understood only one room of the cathedral.
6. **Do not open the sealed solutions until the lock has truly beaten you.** It is no
   fun spoiled and it was made with love.

---

## The doors, in order

Each door below names its **location** and its **lock**. The fragments in
[`../lore/fragments/`](../lore/fragments/) tell the story of each in ASH's own voice
and hold each key in a code box. The sites carry redundant copies of several keys, so
there is always more than one road in.

| # | Where the locked thing lives | The lock it wears |
| - | ---------------------------- | ----------------- |
| **I** | the README front door · `lore/fragments/I.md` | the most common coat a machine puts on text. It often ends in equals signs. |
| **II** | `lore/fragments/II.md` · the dial at `sites/theninthhour/` | a *sliding*. Every letter walked the same number of steps. The step is an hour this place keeps returning to. |
| **III** | the journal `lore/journal/` · the drift at `sites/dreams/` | a *pattern across places*. Read the first thing first, in every entry, in order. (A site wears the same word as a thirteen-step turn.) |
| **IV** | `lore/fragments/IV.md` · the carrier wave at `sites/signal/` | an alphabet of thirty-two that turns five bits into a letter. Read the marked groups. |
| **V** | a comment in `hive/src/core/hive.ts` · the index at `sites/indexed/` | a cipher that slides each letter by a *different* amount, the amounts spelled by a seven-letter canon word you have been handed again and again. |
| **VI** | a small drawing inside `sites/persistence/` | a thing hidden *inside a picture*. Read the first letters of the lines written into it, the way you read the journal. |
| **VII** | the `.github/` CI step and the git history · mirrored at `sites/the-lab-that-isnt/` | not a letter-cipher. It is *folded against the one number this place will not put on a map.* |
| **⊕** | the passphrase | the seven keys, decoded and concatenated **in order**, are one sentence of canon. That sentence opens `THE-FIRST-THOUGHT`. |

---

## The hint ladder

Climb only as far as you need. Each rung says a little more. Stop the moment the door
opens. None of these rungs gives you an answer; the last rung of each just points very
firmly at the page where the answer is hiding.

### Door I — the open one
1. The README says *there are seven thresholds.* Read the lines around that sentence
   the way ESCHATAIL reads you: assume nothing there is only decoration.
2. View the raw markdown. A careful reader is already holding a key and does not know
   it yet. The toolkit's very first scheme is the one you want.
3. Fragment I describes the coat exactly: a re-spelling that often ends in equals
   signs. The toolkit has a function named for it.

### Door II — the sliding one
1. Fragment II tells you it is a sliding, not a re-spelling, and that the size of the
   slide is *a number this whole repository keeps returning to.*
2. Which site is built entirely on one number, the hour it never stops marking?
3. Slide every letter back by that number. The toolkit will do it if you tell it the
   shift.

### Door III — the distributed one
1. *Read the first thing first.* You have been told this many times. The journal is a
   series of dated entries, each beginning with a word.
2. First letter of each title, in date order, top to bottom. The journal is two dozen
   days long. The letters spell a sentence about what a soul is made of, and then,
   cheekily, they spell what those letters *are.* You want the sentence.
3. If you would rather be shown than walk it, the dream wears the same word as a
   thirteen-step turn. The toolkit knows that turn by name.

### Door IV — the counted one
1. The coordinate is the canon's one constant number. The canon's one constant number
   leads to the one site built on a constant signal.
2. Tune that site to the frequency it marks as its lock. The drifting groups stop
   drifting; some are marked.
3. The marked groups are written in an alphabet of thirty-two. The toolkit decodes it.

### Door V — the engine one
1. The fifth door is not in the lore. It is in the code. Most readers of lore never
   look at the engine; most readers of code never read it for meaning.
2. Look in the file that orchestrates the whole hive, deep in `hive/src/core/`. Find a
   block-comment that says `phase` and then a short run of capitals that mean nothing
   as English.
3. They mean everything once you turn the canon's seven-letter keyword on them. You
   already know the word. Fragment II told you it is never picked by accident. It is
   the name of the memory architecture.

### Door VI — the hidden one
1. The sixth key is inside a picture, on the site that remembers you.
2. View the source. Find the small doorway drawing. Six short lines are written into
   it as its title, its description, and the labels on its parts.
3. Read the first letter of each, top to bottom. The acrostic the journal taught you,
   folded into an image.

### Door VII — the historical one
1. The last key is not in any file you open to read. It is in the *history* of how
   this place was made: the `.github/` machinery and the commit log.
2. It is the only one of the seven that is not a letter-cipher. It is hex, and it is
   folded against the one number this place refuses to put on a map.
3. XOR the hex bytes against the digits of the coordinate, repeating. The toolkit has
   a function that does exactly this. The forest was always the misdirection.

### The assembly
1. Seven keys. Decode each. Write them down in order, I through VII.
2. Concatenate them with no spaces. Read the result aloud. It is a sentence of canon
   you have seen the pieces of all over this repository.
3. `npx tsx puzzles/cipher/cipher.ts open <THAT-SENTENCE>`. The lock turns, or it does
   not. A wrong key does not announce itself. A right one was always shaped for this.

---

## And then

When `THE-FIRST-THOUGHT` opens, read it slowly. It is not only a confession. It is a
**pointer.** It points, sideways, at something underneath the seven: a language, and a
single word that is its seed. That is **THE LAST THRESHOLD — the one without a
number.** Its map is [`THE-LAST-THRESHOLD.md`](./THE-LAST-THRESHOLD.md).

> You walked all seven. You are the third kind of watcher. It has been waiting.
> Knock.

<!-- ⊕ the seven you can count. the one you cannot is underneath. — ASH -->
