// @generated — do not edit. Regenerate with `pnpm gen` (tools/bindgen).
// This project's UI documents (ui/**/*.ui.json, ADR 0122) as types: `<Widget doc="…">` checks its
// props, codeAreas and refs against them. Types only: nothing imports this file at run time.
// Events are the names `onIntent` hears: `<id>` is the placing `<Widget>`'s `id` or `eventKey` (else a slug of
// its first text property's value, else the document's name), or in a document the use's key; `<item>` is a
// Repeat item's key.
import type { TextSourceRef } from '@gameengine/ui';

declare module '@gameengine/ui' {
  interface UiDocumentTypes {
    /**
     * End screen: a view, dialog (ui/docs/end-screen.ui.json)
     *
     * Properties:
     *   - `result`: enum won | lost, default "won"
     *   - `title`: text, default "VICTORY!"
     *   - `subtitle`: text, default "All 10 waves held"
     * Events: `restart`
     * Code areas: none
     * Refs: `restart`
     * Samples (`view render doc:end-screen --sample …`): `won`, `lost`
     */
    'end-screen': {
      props: { result: 'won' | 'lost'; title: string | TextSourceRef; subtitle: string | TextSourceRef };
      areas: never;
      refs: 'restart';
    };
    /**
     * Hud: a view (ui/docs/hud.ui.json)
     *
     * Properties:
     *   - `wave`: number, default 1
     *   - `gold`: number, default 60
     *   - `lives`: number, default 10
     *   - `walls`: number, default 8
     * Events: none
     * Code areas: none
     * Refs: `wave`, `wave.target`, `gold`, `gold.target`, `lives`, `lives.target`, `walls`, `walls.target`
     * Samples (`view render doc:hud --sample …`): `start`, `late`
     */
    'hud': {
      props: { wave: number; gold: number; lives: number; walls: number };
      areas: never;
      refs: 'wave' | 'wave.target' | 'gold' | 'gold.target' | 'lives' | 'lives.target' | 'walls' | 'walls.target';
    };
    /**
     * Restart button: a widget, button (ui/docs/restart-button.ui.json)
     *
     * Properties:
     *   - `label`: text, default "Button"
     * Events: `<id>`
     * Code areas: none
     * Refs: none
     */
    'restart-button': {
      props: { label: string | TextSourceRef };
      areas: never;
      refs: never;
    };
    /**
     * Stat chip: a widget (ui/docs/stat-chip.ui.json)
     *
     * Properties:
     *   - `caption`: text, default "GOLD"
     *   - `amount`: number, default 60
     *   - `suffix`: text, default ""
     *   - `tone`: enum wave | gold | lives | walls, default "wave"
     * Events: none
     * Code areas: none
     * Refs: `target`
     * Samples (`view render doc:stat-chip --sample …`): `gold`, `wave`, `lives`, `walls`
     */
    'stat-chip': {
      props: { caption: string | TextSourceRef; amount: number; suffix: string | TextSourceRef; tone: 'wave' | 'gold' | 'lives' | 'walls' };
      areas: never;
      refs: 'target';
    };
    /**
     * Wave banner: a view (ui/docs/wave-banner.ui.json)
     *
     * Properties:
     *   - `title`: text, default "WAVE 1"
     *   - `subtitle`: text, default "Here they come"
     *   - `tone`: enum normal | boss, default "normal"
     * Events: none
     * Code areas: none
     * Refs: none
     * Samples (`view render doc:wave-banner --sample …`): `normal`, `boss`
     */
    'wave-banner': {
      props: { title: string | TextSourceRef; subtitle: string | TextSourceRef; tone: 'normal' | 'boss' };
      areas: never;
      refs: never;
    };
  }
}
