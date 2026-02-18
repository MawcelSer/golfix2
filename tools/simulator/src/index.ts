#!/usr/bin/env node

import { Command } from "commander";

import { runDryMode, runLiveSimulation } from "./engine";
import { generateRandomScenario, getScenario, listScenarios } from "./scenarios/index";
import { scenarioDefinitionSchema } from "./types";
import type { SimulatorOptions } from "./types";

const program = new Command();

program
  .name("simulate")
  .description("Simulateur de parcours de golf — génère des traces GPS réalistes")
  .version("0.1.0")
  .option("-s, --scenario <name>", "Scénario à utiliser", "happy-path")
  .option("--speed <factor>", "Facteur d'accélération temporelle", "30")
  .option("--groups <count>", "Nombre de groupes (mode random uniquement)")
  .option("--seed <number>", "Graine aléatoire pour reproductibilité")
  .option("-v, --verbose", "Afficher les positions GPS détaillées", false)
  .option("--dry-run", "Générer sans connexion réseau", false)
  .option("--api-url <url>", "URL de l'API Golfix", "http://localhost:3000")
  .action(async (opts) => {
    const options: SimulatorOptions = {
      scenario: opts.scenario as string,
      speed: parseInt(opts.speed as string, 10),
      groups: opts.groups ? parseInt(opts.groups as string, 10) : undefined,
      seed: opts.seed ? parseInt(opts.seed as string, 10) : undefined,
      verbose: opts.verbose as boolean,
      dryRun: opts.dryRun as boolean,
      apiUrl: opts.apiUrl as string,
    };

    // Resolve scenario
    let scenario;
    if (options.scenario === "random") {
      const groupCount = options.groups ?? 4;
      const seed = options.seed ?? Date.now();
      scenario = generateRandomScenario(groupCount, seed);
      console.log(`Scénario aléatoire: ${groupCount} groupes, seed ${seed}`);
    } else {
      scenario = getScenario(options.scenario);
      if (!scenario) {
        console.error(
          `Scénario inconnu: "${options.scenario}". Disponibles: ${listScenarios().join(", ")}, random`,
        );
        process.exit(1);
      }
    }

    // Validate scenario
    const result = scenarioDefinitionSchema.safeParse(scenario);
    if (!result.success) {
      console.error("Scénario invalide:", result.error.format());
      process.exit(1);
    }

    // Run simulation
    if (options.dryRun) {
      runDryMode(result.data, options);
    } else {
      try {
        await runLiveSimulation(result.data, options);
      } catch (err) {
        console.error("Erreur simulation:", err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    }
  });

// List command
program
  .command("list")
  .description("Lister les scénarios disponibles")
  .action(() => {
    console.log("Scénarios disponibles:");
    for (const name of listScenarios()) {
      const scenario = getScenario(name)!;
      console.log(`  ${name} — ${scenario.description}`);
    }
    console.log("  random — Scénario aléatoire procédural");
  });

program.parse();
