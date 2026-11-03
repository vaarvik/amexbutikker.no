import { CompositionRoot } from './composition-root.js';

await CompositionRoot.fromEnv(process.env).start();
