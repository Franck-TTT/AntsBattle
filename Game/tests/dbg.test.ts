import { worldTest, expect } from '@gameengine/test';
import { Run } from '../src/schema.gen.ts';

// Regression: the flow field must be filled before any placement, or the first ants never leave the nest.
worldTest('the first ants reach the base with nothing built', async ({ world, step }) => {
  await step(60 * 15);
  expect(world.resource(Run).baseHits).toBeGreaterThan(0);
});
