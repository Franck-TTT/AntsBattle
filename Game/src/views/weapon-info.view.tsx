/** The weapon info popup (ui/docs/weapon-info.ui.json): a tap on a weapon opens it and pauses the run. */
import { defineView, Widget } from '@gameengine/ui';

export interface WeaponInfoModel {
  /** Where it is: "IN THE OFFER · 40 GOLD", "ON THE BOARD". */
  kicker: string;
  name: string;
  desc: string;
  /** Its stats, one chip each (only the ones this weapon has). */
  info: readonly { key: string; k: string; v: string; color: 'pink' | 'blue' | 'green' | 'gold' }[];
}

export const WeaponInfoView = defineView<WeaponInfoModel>({
  name: 'WeaponInfo',
  description: 'A weapon: name, what it does and its stats (damage, fire rate, range, area, effects). Intents: close (close button or tap outside).',
  samples: {
    tower: { kicker: 'IN THE OFFER · 40 GOLD', name: 'Tower', desc: 'Fast single-target shots', info: [{ key: 'damage', k: 'Damage', v: '2', color: 'pink' }, { key: 'rate', k: 'Fire rate', v: '7.1 / s', color: 'blue' }, { key: 'range', k: 'Range', v: '2.3 cells', color: 'green' }] },
    radar: { kicker: 'ON THE BOARD', name: 'Radar', desc: 'Does not shoot: the weapons around it get more range and fire faster', info: [{ key: 'range', k: 'Range', v: '1.5 cells', color: 'green' }, { key: 'auraRange', k: 'Range bonus', v: '+0.5 cells', color: 'blue' }, { key: 'auraRate', k: 'Fire rate bonus', v: '+20%', color: 'gold' }] },
  },
  render: (model, { intent }) => (
    <Widget
      doc="weapon-info"
      props={{ kicker: () => model().kicker, name: () => model().name, desc: () => model().desc, info: () => model().info }}
      onIntent={() => intent('close')}
    />
  ),
});
