#!/usr/bin/env node
/**
 * Skill Create Output Handler
 *
 * Cross-platform (Windows, macOS, Linux)
 *
 * Formats and writes generated skill files when creating new skills.
 */

const path = require('path');
const { writeFile, ensureDir, getProjectRoot, log } = require('./lib/utils');

async function main() {
  const skillName = process.argv[2];
  const skillContent = process.argv[3];

  if (!skillName) {
    log('Usage: skill-create-output.js <skill-name> [content]');
    process.exit(1);
  }

  const projectRoot = getProjectRoot();
  const skillDir = path.join(projectRoot, '.claude', 'skills', skillName);

  ensureDir(skillDir);

  // Create SKILL.md
  const skillMd = skillContent || `# ${skillName}

## Description

<!-- Describe what this skill does -->

## When to Use

<!-- When should this skill be activated? -->

## Instructions

<!-- Step-by-step instructions for the skill -->

## Examples

<!-- Example usage and expected outcomes -->
`;

  writeFile(path.join(skillDir, 'SKILL.md'), skillMd);

  // Create config.json
  const config = {
    name: skillName,
    version: '1.0.0',
    description: '',
    triggers: [],
    tags: []
  };

  writeFile(path.join(skillDir, 'config.json'), JSON.stringify(config, null, 2));

  console.log(`Skill created: .claude/skills/${skillName}/`);
  console.log(`  - SKILL.md`);
  console.log(`  - config.json`);
}

main().catch(err => {
  console.error('Skill creation failed:', err.message);
  process.exit(1);
});
