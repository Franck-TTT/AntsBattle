// Worlds + Play mode: the world structure and the level layout on the left (tabs), the running game in the centre, the QA Cheats widget on the right, the cheats panel below.
import { defineEditorMode } from '@gameengine/editor-api';

export default defineEditorMode(() => ({
  id: 'antsbattle.worldsAndPlay',
  title: 'Worlds + Play',
  icon: 'WP',
  hint: 'Arrange the levels of each world, play them and use the cheats',
  panels: [
    { widget: 'antsbattle.worlds', dock: 'left', size: 420 },
    { widget: 'antsbattle.levelLayout', dock: 'left' },
    { builtin: 'play', dock: 'center' },
    { widget: 'antsbattle.qaCheats', dock: 'right', size: 320 },
    { builtin: 'cheats', dock: 'bottom', size: 220 },
  ],
}));
