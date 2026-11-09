import { it, expect } from 'vitest';
import { runMediaCommand } from '../../apps/worker/src/media.js';
it('terminates a stuck media subprocess within its bounded timeout', async () => {
  const start = performance.now();
  await expect(
    runMediaCommand(process.execPath, ['-e', 'setInterval(()=>{},1000)'], 150),
  ).rejects.toMatchObject({ code: 'MEDIA_TIMEOUT', permanent: false });
  expect(performance.now() - start).toBeLessThan(3000);
});
