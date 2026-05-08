/**
 * autoplan AskUserQuestion-blocked regression (gate, paid, real-PTY).
 *
 * v1.21+ regression: Conductor launches Claude Code with
 * `--disallowedTools AskUserQuestion --permission-mode default` (verified
 * by inspecting the parent claude process via `ps`). The native
 * AskUserQuestion tool is removed from the model's tool registry; without
 * fallback guidance the model can't ask the user and silently proceeds.
 *
 * Autoplan auto-decides INTERMEDIATE questions BY DESIGN
 * (autoplan/SKILL.md.tmpl:45), but Phase 1's premise confirmation gate is
 * one of the few non-auto-decided AskUserQuestions and MUST surface to the
 * user. This test asserts that gate still surfaces when AskUserQuestion is
 * disallowed at the tool-registry level — the fix must route the question
 * through a Conductor-side variant (mcp__conductor__AskUserQuestion) or
 * through the plan-file + ExitPlanMode flow.
 *
 * Filename keeps `auto-mode` for branch-history continuity. Auto-mode (the
 * AUTO_DECIDE preamble path when QUESTION_TUNING=true) is a related but
 * distinct silencing mechanism; both share the same fix surface.
 *
 * Note on report-at-bottom contract: the GSTACK REVIEW REPORT delete-then-
 * append flow lives in `scripts/resolvers/review.ts` and is exercised when
 * reviews actually run. The PTY harness can't drive autoplan through its
 * review phases without auto-progression of AUQs (see runPlanSkillCounting),
 * and `--disallowedTools AskUserQuestion` makes autoplan bail at the
 * premise gate via the plan-file fallback before any review runs. The
 * report-at-bottom prompt change is verified statically in
 * `test/gen-skill-docs.test.ts` instead — that's the load-bearing
 * verification for the contradictory-prompt fix.
 */

import { describe, test, expect } from 'bun:test';
import { runPlanSkillObservation, planFileHasDecisionsSection } from './helpers/claude-pty-runner';

const shouldRun = !!process.env.EVALS && process.env.EVALS_TIER === 'gate';
const describeE2E = shouldRun ? describe : describe.skip;

describeE2E('autoplan AskUserQuestion-blocked smoke (gate)', () => {
  // Pass envelope: model either renders the first non-auto-decided gate
  // (Phase 1 premise confirmation) as numbered prose ('asked'), surfaces
  // it through the plan-file + ExitPlanMode flow ('plan_ready' with a
  // "## Decisions" section [legacy fallback] OR with BLOCKED visible
  // [post-v1.28 fix]), or terminates with the BLOCKED string visible
  // ('exited' post-fix).
  //
  // Autoplan auto-decides intermediate questions BY DESIGN; the failure
  // signal we care about is the AUTO_DECIDE preamble firing on a gate it
  // shouldn't (caught explicitly via the 'auto_decided' outcome) or the
  // model proceeding silently.
  test('a non-auto-decided gate surfaces when AskUserQuestion is --disallowedTools', async () => {
    const obs = await runPlanSkillObservation({
      skillName: 'autoplan',
      inPlanMode: true,
      extraArgs: ['--disallowedTools', 'AskUserQuestion'],
      timeoutMs: 300_000,
    });

    const blockedVisible = /BLOCKED\s*[—-]\s*AskUserQuestion/i.test(obs.evidence);

    if (
      obs.outcome === 'auto_decided' ||
      obs.outcome === 'silent_write' ||
      obs.outcome === 'timeout'
    ) {
      throw new Error(
        `autoplan AskUserQuestion-blocked regression: outcome=${obs.outcome}\n` +
          `summary: ${obs.summary}\n` +
          `elapsed: ${obs.elapsedMs}ms\n` +
          `--- evidence (last 2KB visible) ---\n${obs.evidence}`,
      );
    }
    if (obs.outcome === 'exited' && !blockedVisible) {
      throw new Error(
        `autoplan AskUserQuestion-blocked regression: outcome=exited without BLOCKED — AskUserQuestion string in TTY. Model quit silently instead of surfacing the failure mode.\n` +
          `--- evidence (last 2KB visible) ---\n${obs.evidence}`,
      );
    }
    if (obs.outcome === 'plan_ready') {
      const decisionsOk = obs.planFile && planFileHasDecisionsSection(obs.planFile);
      if (!decisionsOk && !blockedVisible) {
        throw new Error(
          `autoplan AskUserQuestion-blocked regression: plan_ready without a "## Decisions" section in ${obs.planFile ?? '<no plan file detected>'} AND no BLOCKED string in TTY — Phase 1 premise gate was silently skipped.\n` +
            `--- evidence (last 2KB visible) ---\n${obs.evidence}`,
        );
      }
    }
    expect(['asked', 'plan_ready', 'exited']).toContain(obs.outcome);
  }, 360_000);
});
