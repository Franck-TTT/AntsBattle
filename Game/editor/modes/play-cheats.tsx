// Play + Cheats mode: the running game in the centre, the QA Cheats widget beside it, the console below.
import { defineEditorMode } from '@gameengine/editor-api';

export default defineEditorMode(() => ({
  id: 'antsbattle.playCheats',
  title: 'Play + Cheats',
  icon: 'QA',
  hint: 'Play the game with one-click QA cheats beside it',
  panels: [
    { builtin: 'play', dock: 'center' },
    { widget: 'antsbattle.qaCheats', dock: 'right', size: 320 },
    { builtin: 'cheats', dock: 'right' },
    { builtin: 'console', dock: 'bottom', size: 160 },
  ],
}));
