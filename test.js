#!/usr/bin/env node
'use strict';
/**
 * GothicLockPicker — Test Suite & CLI
 * Run: node test.js
 */

const { createLock, randomLock, applyMove, legalMoves, solve, distanceToGoal, TARGET, HOLES } = require('./solver.js');

let passed = 0, failed = 0;

function assert(condition, label) {
  if (condition) { console.log('  ✓', label); passed++; }
  else           { console.error('  ✗ FAIL:', label); failed++; }
}

// ────────────────────────────────────────────────────────
console.log('\n═══ GothicLockPicker Test Suite ═══\n');

// ── 1. Already solved
console.log('▶ 1. Already solved lock');
{
  const lock = createLock([3,3,3,3,3], [[],[],[],[],[]]);
  const r = solve(lock);
  assert(r.solved === true, 'solved = true');
  assert(r.alreadySolved === true, 'alreadySolved = true');
  assert(r.path.length === 0, 'path is empty');
}

// ── 2. Simple 1-plate lock
console.log('\n▶ 2. Single plate, position 0 → needs 3 right moves to reach target=3');
{
  const lock = createLock([0], [[]]);
  const r = solve(lock);
  assert(r.solved, 'solvable');
  assert(r.path.length === 3, 'exactly 3 moves');
  assert(r.path.every(m => m.dir === 1), 'all moves right (0→1→2→3)');
}

// ── 3. Plate at rightmost-before-target (pos 3) — already at target
console.log('\n▶ 3. Plate at target position');
{
  const lock = createLock([3], [[]]);
  const r = solve(lock);
  assert(r.solved, 'solved');
  assert(r.alreadySolved, 'already solved');
}

// ── 4. Move right blocked only at rightmost edge
console.log('\n▶ 4. Move right free through target, blocked only at edge (HOLES-1=6)');
{
  const result = applyMove([3], 0, 1, [[]]);
  assert(result.ok, 'move right from target is allowed');
  assert(result.state[0] === 4, 'position advanced past target to 4');
}

{
  const result = applyMove([4], 0, 1, [[]]);
  assert(result.ok, 'move right from pos 4 is allowed');
}

{
  const result = applyMove([6], 0, 1, [[]]);
  assert(!result.ok, 'move right blocked at rightmost edge (pos=6)');
  assert(result.reason === 'already_rightmost', 'correct reason');
}

// ── 5. Move left restriction at leftmost
console.log('\n▶ 5. Move left blocked at position 0');
{
  const result = applyMove([0], 0, -1, [[]]);
  assert(!result.ok, 'move left blocked at 0');
}

// ── 6. Dependency dragging (same direction)
console.log('\n▶ 6. Plate with dependency drags neighbor same direction');
{
  const state = [4, 4];
  const deps  = [[{idx: 1, rev: false}], []];
  const result = applyMove(state, 0, -1, deps);
  assert(result.ok, 'move ok');
  assert(result.state[0] === 3, 'primary moved left');
  assert(result.state[1] === 3, 'dependent moved left');
}

// ── 6b. Reversed dependency drags neighbor in opposite direction
console.log('\n▶ 6b. Reversed dependency drags neighbor in opposite direction');
{
  // Plate 0 moves right → plate 1 (rev) moves left
  const state = [2, 4];
  const deps  = [[{idx: 1, rev: true}], []];
  const result = applyMove(state, 0, 1, deps);
  assert(result.ok, 'move ok');
  assert(result.state[0] === 3, 'primary moved right 2→3');
  assert(result.state[1] === 3, 'dependent moved left (reversed) 4→3');
}

// ── 7. Dependency: dependent at edge blocks the whole move
console.log('\n▶ 7. Move blocked when dependent cannot move (strict deps)');
{
  // plate 0 moves left, drags plate 1 left — but plate 1 is at 0, can't go further
  const state = [4, 0];
  const deps  = [[{idx: 1, rev: false}], []];
  const result = applyMove(state, 0, -1, deps);
  assert(!result.ok, 'move blocked (dep at leftmost edge)');
  assert(result.reason === 'dep_blocked', 'reason is dep_blocked');
}
{
  // plate 4 (pos 5) moves right, dep plate 5 (rev) must go left but is at 0 — blocks
  const state = [0, 0, 0, 0, 5, 0];
  const deps  = [[],[],[],[],[{idx: 5, rev: true}],[]];
  const result = applyMove(state, 4, 1, deps);
  assert(!result.ok, 'move blocked (reversed dep at leftmost edge)');
}

// ── 8. 5-plate random solves
console.log('\n▶ 8. Solve 20 random 5-plate locks');
{
  let allSolved = true;
  let totalMoves = 0;
  for (let i = 0; i < 20; i++) {
    const lock = randomLock(5);
    const r = solve(lock);
    if (!r.solved) { allSolved = false; console.error('   Failed lock:', lock.positions); }
    else totalMoves += r.path.length;
  }
  assert(allSolved, 'all 20 random locks solved');
  console.log('   Avg steps:', (totalMoves / 20).toFixed(1));
}

// ── 9. Solution path correctness
console.log('\n▶ 9. Verify solution path leads to goal');
{
  const lock = randomLock(5);
  const r = solve(lock);
  if (r.solved && !r.alreadySolved) {
    let state = [...lock.positions];
    let valid = true;
    for (const mv of r.path) {
      const res = applyMove(state, mv.plateIdx, mv.dir, lock.deps);
      if (!res.ok) { valid = false; break; }
      // Check stateAfter matches
      if (res.state.join(',') !== mv.stateAfter.join(',')) { valid = false; break; }
      state = res.state;
    }
    assert(valid, 'all moves in path are legal');
    assert(state.every(p => p === TARGET), 'final state is goal');
  } else {
    assert(true, 'skipped (already solved)');
  }
}

// ── 10. distanceToGoal
console.log('\n▶ 10. distanceToGoal');
{
  assert(distanceToGoal([3,3,3]) === 0, 'all at target → 0');
  assert(distanceToGoal([0,6,3]) === 3+3+0, '[0,6,3] → 6');
  assert(distanceToGoal([0,0,0,0,0]) === 15, 'all at 0 → 15');
}

// ── 11. createLock validation
console.log('\n▶ 11. createLock throws on mismatched deps');
{
  let threw = false;
  try { createLock([0,0], [[]]); } catch { threw = true; }
  assert(threw, 'throws on mismatched deps length');
}

// ── 12. Legal moves count
console.log('\n▶ 12. legalMoves — single plate all positions');
{
  // pos=0: only right, but right blocked if pos>=TARGET → pos=0 < TARGET=3, right ok; left blocked at 0
  const m0 = legalMoves([0], [[]]);
  assert(m0.length === 1 && m0[0].dir === 1, 'pos=0: only right');

  // pos=3 (target): both directions ok — no restriction at target
  const m3 = legalMoves([3], [[]]);
  assert(m3.length === 2, 'pos=3: both directions (target no longer blocks right)');

  // pos=1: both directions ok
  const m1 = legalMoves([1], [[]]);
  assert(m1.length === 2, 'pos=1: both directions');

  // pos=6: only left (right blocked at edge, HOLES=7)
  const m6 = legalMoves([6], [[]]);
  assert(m6.length === 1 && m6[0].dir === -1, 'pos=6: only left');
}

// ── 13. Specific lock from user spec
// Plate positions (1-based): 3,1,1,3,1
// Deps: plate1 тянет 2-(rev), 3(same);  plate5 тянет 4(same), 3-(rev), 1-(rev)
console.log('\n▶ 13. Specific 5-plate lock with complex cross-deps');
{
  const lock = createLock(
    [2, 0, 0, 2, 0],
    [
      [{idx:1, rev:true}, {idx:2, rev:false}],
      [],
      [],
      [],
      [{idx:3, rev:false}, {idx:2, rev:true}, {idx:0, rev:true}],
    ]
  );

  const r = solve(lock);
  assert(r.solved, 'lock is solvable');
  assert(!r.alreadySolved, 'not already solved');

  // Verify the BFS path is valid and reaches goal
  let state = [...lock.positions];
  let pathOk = true;
  for (const mv of r.path) {
    const res = applyMove(state, mv.plateIdx, mv.dir, lock.deps);
    if (!res.ok) { pathOk = false; break; }
    state = res.state;
  }
  assert(pathOk, 'BFS path is fully legal');
  assert(state.every(p => p === TARGET), 'BFS path reaches goal');
  assert(r.path.length <= 25, 'solved in reasonable steps (<= 25)');
}

// ── Summary ─────────────────────────────────────────────
console.log('\n' + '═'.repeat(40));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('SOME TESTS FAILED'); process.exit(1); }
else { console.log('All tests passed ✓'); }

// ── CLI demo ─────────────────────────────────────────────
console.log('\n═══ Solver Demo ═══\n');
const demoLock = randomLock(5);
console.log('Lock positions:', demoLock.positions.map(p => p+1).join(' · '));
console.log('Dependencies: ', demoLock.deps.map((d,i) => d.length ? `#${i+1}: ${d.map(e=>(e.rev?'←':'→')+'#'+(e.idx+1)).join(' ')}` : '').filter(Boolean).join('  ') || 'none');

const t0 = performance.now();
const res = solve(demoLock);
const dt = (performance.now() - t0).toFixed(2);

if (res.solved) {
  if (res.alreadySolved) {
    console.log('Already solved!');
  } else {
    console.log(`\nSolved in ${res.path.length} moves (explored ${res.explored} states, ${dt}ms):`);
    res.path.forEach((mv, i) => {
      const arrow = mv.dir === -1 ? '←' : '→';
      console.log(`  ${String(i+1).padStart(2)}. Plate #${mv.plateIdx+1} ${arrow}  [${mv.stateAfter.map(p=>p+1).join('·')}]`);
    });
  }
} else {
  console.log('No solution found:', res.reason);
}
