/**
 * gstack - A CLI tool for managing stacked pull requests
 * Main entry point
 */

import { Command } from 'commander';
import * as dotenv from 'dotenv';
import { version } from '../package.json';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('gstack')
  .description('CLI tool for managing stacked pull requests on GitHub')
  .version(version);

/**
 * `gstack sync` - Sync the current stack with GitHub
 */
program
  .command('sync')
  .description('Sync the current stack of branches with GitHub PRs')
  .option('-d, --dry-run', 'Preview changes without applying them')
  .option('-v, --verbose', 'Enable verbose output')
  .action(async (options) => {
    const { sync } = await import('./commands/sync');
    await sync(options);
  });

/**
 * `gstack list` - List all branches in the current stack
 */
program
  .command('list')
  .description('List all branches in the current stack')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const { list } = await import('./commands/list');
    await list(options);
  });

/**
 * `gstack push` - Push current stack and update PRs
 */
program
  .command('push')
  .description('Push all branches in the stack and update PR descriptions')
  .option('-f, --force', 'Force push branches')
  .option('-d, --dry-run', 'Preview changes without applying them')
  .action(async (options) => {
    const { push } = await import('./commands/push');
    await push(options);
  });

/**
 * `gstack rebase` - Rebase the stack onto the base branch
 */
program
  .command('rebase')
  .description('Rebase the entire stack onto the latest base branch')
  .option('-i, --interactive', 'Use interactive rebase')
  .action(async (options) => {
    const { rebase } = await import('./commands/rebase');
    await rebase(options);
  });

/**
 * `gstack checkout <branch>` - Checkout a branch in the stack
 */
program
  .command('checkout <branch>')
  .alias('co')
  .description('Checkout a branch within the current stack')
  .action(async (branch, options) => {
    const { checkout } = await import('./commands/checkout');
    await checkout(branch, options);
  });

// Handle unknown commands
program.on('command:*', () => {
  console.error(`Unknown command: ${program.args.join(' ')}`);
  console.error('Run \'gstack --help\' for available commands.');
  process.exit(1);
});

// Parse CLI arguments
program.parse(process.argv);

// Show help if no command provided
if (process.argv.length < 3) {
  program.help();
}
