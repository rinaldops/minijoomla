import { runTests } from './core.test.js';
import { runStaticUiTests } from './static-ui.test.js';

Promise.resolve().then(runTests).then(runStaticUiTests).catch((error) => { console.error(error); process.exitCode = 1; });
