---
name: text-fields
version: 1.2.0
tier: optional
description: Text fields and the on-screen keyboard — <TextField> for a name, a chat composer or a support message, onChange and onSubmit, maxLength, handing typed text to the sim, avoidKeyboard and useKeyboard, input.text in tests. Use when the player types anything, or when typing is lost, doubled or hidden under the keyboard.
---

# Text fields

Use `<TextField>` from `@gameengine/ui` for everything the player types. Do not build a field from
`TextInput` and `KeyEvent` events: a `LateUpdate` system that collects them loses every character
of a frame that runs two sim steps, which is every frame on a low-end phone, and passes every test
that steps once per frame.

A screen with text fields is a TSX view, not a UI document: a view built as a UI document is not
lifted above the keyboard.

## Three fields

```tsx
import { Button, Row, Screen, Text, TextField, createSignal, createTextFieldHandle, t } from '@gameengine/ui';

// A name: one line, capped.
const [name, setName] = createSignal('');
<TextField id="name" value={name} onChange={setName} placeholder="Your name" maxLength={20} returnKey="done" />;

// A chat composer: the keyboard stays up after each send.
const [draft, setDraft] = createSignal('');
const send = () => {
  const text = draft().trim();
  if (!text) return;
  sendMessage(text); // services or net, from this handler
  setDraft(''); // the field and the keyboard follow the value
};
<Row>
  <TextField id="chat" value={draft} onChange={setDraft} onSubmit={send} submitBehavior="keep" returnKey="send" />
  <Button id="send" label="Send" onPress={send} />
</Row>;

// A support message: several lines, Enter adds a line.
const [message, setMessage] = createSignal('');
<TextField id="support" multiline value={message} onChange={setMessage} maxLength={4000} />;
```

- `value` as a function is controlled, and **the game's value always wins**: after each
  `onChange` the field shows what `value()` returns. Set it inside `onChange`, in that call. A game
  that updates it a frame later (through the sim, a model refill) sees the typed text put back.
  To reject or change input, set the filtered text: the field and the keyboard take it.
- `onChange(text)` gets the whole new text, at most once per UI frame. `onSubmit(text)` is Enter
  or the keyboard's action key on a single-line field. `onBlur(reason)`: `submit`, `escape`,
  `outside` (a press that was not on the field or another control), `program`, `removed`,
  `background`, `console`.
- **Set `maxLength` for every field** (Unicode code points): a name 20, a chat line a few hundred,
  a support message a few thousand. Without it the limit is 16384. A value longer than it is cut,
  and `onChange` reports the cut text once.
- `keyboard`: `text` (default), `number`, `email`, `password` (draws a bullet per character),
  `url`. `returnKey`: `done`, `go`, `next`, `search`, `send`.
- Focus from code: `const field = createTextFieldHandle()`, `<TextField handle={field} />`, then
  `field.focus()`, `field.blur()`, `field.focused()`. `focusOnMount` focuses a field as it appears.
  One field has the typing at a time: focusing another ends the first with `program`.
- Style it in CSS: `.text-field` (it is a scroll container: give it a width and a height),
  `.text-field-focused`, `.text-field-empty`, and on the text `.text-field-text`,
  `.text-field-placeholder`. The placeholder shows while the field is empty and not focused.

## Rules

- **Typing is presentation.** While a field has focus the engine takes the typing before the sim:
  no `TextInput` or `KeyEvent` arrives, no action bound to a key fires, and nothing of it is in a
  replay or the state hash. A press on empty space ends the focus and does not reach the world.
- **Text for the sim is handed over, finished, as recorded input.** A name the sim must know:

  ```ts
  // schema: export const NameChosen = event('NameChosen', {}, { sim: true });
  onSubmit={(text) => emitInputData(NameChosen, JSON.stringify({ name: text }))} // from @gameengine/runtime
  // sim system: events: [NameChosen], runIf: { event: NameChosen }
  for (const { name } of ctx.inputData<{ name: string }>(NameChosen)) setPlayerName(ctx, name);
  ```

  Text for a server (chat, support) goes through `services` or `net` straight from the handler and
  never enters the sim.
- **Never pass player text to `<Text rich>`**: rich text has no escape and could show any project
  image. Show typed text in a plain `<Text>`.
- **Emoji:** they draw only with an emoji font in the project's font chain, and some backends strip
  them. Where a backend does, filter them in `onChange` so the player sees what will be sent. A
  filter must cut whole characters: use `Array.from(text)`, not `text.slice` by index (half an
  emoji shows as `�`).
- Do not tie a field's editing state to `keyboard.changed` or `useKeyboard().visible`: iOS reports
  the keyboard hidden once before it rises, and with a hardware keyboard it is never shown.

## The keyboard and the screen

While a field has the typing and the keyboard is up, its `<Screen>` ends at the keyboard's top:
content anchored to the bottom rises and lists that fill the screen shrink.

- The screen is found as the field's nearest ancestor with `safeArea`, else the root above it: put
  fields in a `<Screen safeArea>`, or in a Screen that is the view's root.
- A screen taller than what the keyboard leaves needs to scroll: wrap its content in a
  `<ScrollView>` that sets no `scrollTo` of its own, and the focused field is scrolled into view.
- `<Screen avoidKeyboard={false}>` switches it off for that screen.
- `useKeyboard()` gives `{ visible, height }` as a signal (`height` in UI units above the safe-area
  bottom) for anything else that must follow the keyboard.

## Test it

```ts
worldTest('the composer keeps every character on a slow phone', async ({ step, input, services }) => {
  await step(2);
  composer.focus(); // a handle the view exposes; presses need a renderTest
  for (const c of 'see you at the finish line') {
    input.text(c);
    await step(1);
  }
  expect(draft()).toBe('see you at the finish line');
  input.key('Enter', true);
  input.key('Enter', false);
  await step(1);
  expect(services.calls('chat.send').length).toBe(1);
}, { stepsPerFrame: 2 });
```

- `input.text('hi')` types as a keyboard does; `input.key('Backspace', true)` then `false` deletes
  one character; Enter submits. `services.calls('keyboard.show')` shows what the keyboard was
  given.
- Run typing tests with `{ stepsPerFrame: 2 }` as well: that is a phone at 30 fps (skill `testing`).
- Pressing a field (`ui.press('name')`) needs a `renderTest`. In a T0 `worldTest` there is no
  layout, so focus through a handle; any pointer press there counts as outside the field.
- The keyboard's size in a render test: `services.emit('keyboard', 'changed', { visible: true, height: 300 })`
  (points), then check `ui.rect` of the field against the view's height minus 300.

## Limits

- Editing is at the end of the text only: no caret movement, no selection. The caret is a `|` drawn
  after the text.
- No paste on desktop (the phone keyboards paste as typed text). Backspace on a desktop keyboard
  removes one code point, so an emoji built of several loses a part, and a held Backspace deletes
  once.
- No on-screen keyboard on the mobile web.
- A word wider than its box is cut, not wrapped: text breaks at spaces and other break
  opportunities. Give a list of player text `overflow-x: hidden` so one long word cannot make it
  scroll sideways.
