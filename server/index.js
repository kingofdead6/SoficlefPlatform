import { createApp } from './src/app.js';
import { serverEnv } from './src/config/env.js';

const app = createApp();
const env = serverEnv();

app.listen(env.PORT, () => {
  console.log(`Soficlef API listening on http://localhost:${env.PORT}`);
});
