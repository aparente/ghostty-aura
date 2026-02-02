#!/usr/bin/env node
// ghostty-aura: Interactive setup wizard
// Generates ~/.claude/aura-config.json with user preferences.
'use strict';

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { DEFAULTS, CONFIG_PATH } = require('./config');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

const PRESETS = {
  subtle:  { intensityScale: 0.6, steps: 6,  step_ms: 150 },
  medium:  { intensityScale: 1.0, steps: 8,  step_ms: 120 },
  bold:    { intensityScale: 1.4, steps: 10, step_ms: 100 },
};

async function main() {
  console.log('\n  ✦ ghostty-aura setup\n');

  if (fs.existsSync(CONFIG_PATH)) {
    const overwrite = await ask('  Config already exists. Overwrite? (y/N) ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('  Keeping existing config.');
      rl.close();
      return;
    }
  }

  // 1. Intensity preference
  console.log('\n  How noticeable should the color shifts be?');
  console.log('    1) subtle  — gentle tints, barely visible');
  console.log('    2) medium  — noticeable but not distracting (default)');
  console.log('    3) bold    — vivid color shifts');
  const intensityChoice = (await ask('  Choice [2]: ')).trim() || '2';
  const preset = PRESETS[['subtle', 'medium', 'bold'][parseInt(intensityChoice) - 1]] || PRESETS.medium;

  // 2. Animation speed
  console.log('\n  Animation speed:');
  console.log('    1) slow    — relaxed transitions');
  console.log('    2) normal  — balanced (default)');
  console.log('    3) fast    — snappy transitions');
  const speedChoice = (await ask('  Choice [2]: ')).trim() || '2';
  const speedMultiplier = [1.5, 1.0, 0.6][parseInt(speedChoice) - 1] || 1.0;

  // 3. Which states to enable
  console.log('\n  Which states do you want? (comma-separated, or "all")');
  console.log('    connected, working, needs_input, completed, error');
  const statesInput = (await ask('  States [all]: ')).trim().toLowerCase() || 'all';
  const enabledStates = statesInput === 'all'
    ? Object.keys(DEFAULTS.states)
    : statesInput.split(',').map((s) => s.trim()).filter((s) => DEFAULTS.states[s]);

  // Build config
  const states = {};
  for (const name of enabledStates) {
    const base = DEFAULTS.states[name];
    states[name] = {
      ...base,
      intensity: Math.round(base.intensity * preset.intensityScale * 100) / 100,
    };
  }

  const config = {
    states,
    animation: {
      steps: preset.steps,
      step_ms: Math.round(preset.step_ms * speedMultiplier),
    },
  };

  // Write
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');

  console.log(`\n  ✓ Config written to ${CONFIG_PATH}`);
  console.log('  Run "node lib/setup.js" again to reconfigure.\n');

  rl.close();
}

main().catch((err) => {
  console.error(err);
  rl.close();
  process.exit(1);
});
