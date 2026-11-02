/* Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT License. */
// Run the ORIGINAL browser test runner. Explicit executable override is diagnostic-only.
// Record that browser's version separately; it is not the upstream pinned browser.
if (process.env.AGENT_FIRST_CHROMIUM) {
	const pw = require('../../node_modules/@playwright/test');
	const launch = pw.chromium.launch.bind(pw.chromium);
	pw.chromium.launch = options => launch({ ...options, executablePath: process.env.AGENT_FIRST_CHROMIUM });
}
require('../../test/unit/browser/index.js');
