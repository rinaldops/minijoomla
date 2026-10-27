import { runTests } from './core.test.js';

runTests().catch((error) => { console.error(error); process.exitCode = 1; });
