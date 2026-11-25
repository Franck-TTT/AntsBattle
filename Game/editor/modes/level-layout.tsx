// Level Layout mode: the layout widget beside the game view, to paint a level and play it at once.
import { defineEditorMode } from '@gameengine/editor-api';

export default defineEditorMode(() => ({
  id: 'antsbattle.levelLayout',
  title: 'Level Layout',
  icon: 'LD',
  hint: 'Pre-placed blocks and weapons of each level',
  panels: [
    { widget: 'antsbattle.levelLayout', dock: 'left', size: 420 },
    { builtin: 'play', dock: 'center' },
  ],
}));
