// Tune + Play mode: the sheet's General parameters on the left, the running game in the centre, the QA Cheats and the cheats panel on the right (tabs).
import { defineEditorMode } from '@gameengine/editor-api';

export default defineEditorMode(() => ({
  id: 'antsbattle.tuneAndPlay',
  title: 'Tune + Play',
  icon: 'TP',
  hint: "Tweak the sheet's General parameters live, play, and use the cheats",
  panels: [
    { widget: 'antsbattle.generalParams', dock: 'left', size: 420 },
    { builtin: 'play', dock: 'center' },
    { widget: 'antsbattle.qaCheats', dock: 'right', size: 320 },
    { builtin: 'cheats', dock: 'right' },
  ],
}));
