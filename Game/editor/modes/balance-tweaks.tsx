// Balance Tweaks mode: the running game in the centre, the sheet's General parameters beside it to tweak live.
import { defineEditorMode } from '@gameengine/editor-api';

export default defineEditorMode(() => ({
  id: 'antsbattle.balanceTweaks',
  title: 'Balance Tweaks',
  icon: 'BT',
  hint: "Tweak the sheet's General parameters live while playing",
  panels: [
    { builtin: 'play', dock: 'center' },
    { widget: 'antsbattle.generalParams', dock: 'right', size: 420 },
    { builtin: 'console', dock: 'bottom', size: 140 },
  ],
}));
