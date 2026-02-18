#!/usr/bin/env node
/**
 * Package Manager Setup Script
 *
 * Cross-platform (Windows, macOS, Linux)
 *
 * Detects and configures the project's package manager.
 * Saves the result to .claude/package-manager.json
 */

const path = require('path');
const { detectPackageManager, getRunCommand, getInstallCommand } = require('./lib/package-manager');
const { writeFile, getProjectRoot, log } = require('./lib/utils');

async function main() {
  const forcepm = process.argv[2];

  let result;

  if (forcepm) {
    const valid = ['npm', 'pnpm', 'yarn', 'bun'];
    if (!valid.includes(forcepm)) {
      log(`Invalid package manager: ${forcepm}. Valid options: ${valid.join(', ')}`);
      process.exit(1);
    }
    result = { packageManager: forcepm, source: 'manual', lockfile: null };
  } else {
    result = detectPackageManager();
  }

  // Save to .claude/package-manager.json
  const configPath = path.join(getProjectRoot(), '.claude', 'package-manager.json');
  const config = {
    packageManager: result.packageManager,
    detectedAt: new Date().toISOString(),
    lockfile: result.lockfile,
    source: result.source
  };

  writeFile(configPath, JSON.stringify(config, null, 2));

  console.log(`Package manager: ${result.packageManager} (detected via ${result.source})`);
  console.log(`Run command: ${getRunCommand(result.packageManager)}`);
  console.log(`Install command: ${getInstallCommand(result.packageManager)}`);
  console.log(`Config saved to: ${configPath}`);
}

main().catch(err => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
