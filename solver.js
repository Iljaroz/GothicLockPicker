(function () {
  "use strict";

  /**
   * GothicLockPicker — Solver Engine
   */

  const TARGET = 3;
  const HOLES = 7;

  function createLock(positions, deps) {
    const n = positions.length;
    if (deps.length !== n)
      throw new Error("deps length must match positions length");
    return {
      positions: [...positions],
      deps: deps.map((d) => d.map((e) => ({ idx: e.idx, rev: !!e.rev }))),
      n,
    };
  }

  function randomLock(n = 5) {
    let lock;
    do {
      let positions;
      do {
        positions = Array.from({ length: n }, () =>
          Math.floor(Math.random() * HOLES),
        );
      } while (positions.every((p) => p === TARGET));

      const deps = positions.map((_, i) => {
        if (Math.random() < 0.4) {
          const others = [...Array(n).keys()].filter((j) => j !== i);
          if (others.length === 0) return [];
          const pick = others[Math.floor(Math.random() * others.length)];
          return [{ idx: pick, rev: Math.random() < 0.5 }];
        }
        return [];
      });

      lock = createLock(positions, deps);
    } while (!solve(lock).solved);

    return lock;
  }

  function applyMove(state, plateIdx, dir, deps) {
    const pos = state[plateIdx];

    if (dir === -1 && pos <= 0) {
      return { ok: false, reason: "already_leftmost" };
    }
    if (dir === 1 && pos >= HOLES - 1) {
      return { ok: false, reason: "already_rightmost" };
    }

    for (const dep of deps[plateIdx]) {
      const depDir = dep.rev ? -dir : dir;
      const dp = state[dep.idx];
      if (depDir === -1 && dp <= 0) return { ok: false, reason: "dep_blocked" };
      if (depDir === 1 && dp >= HOLES - 1)
        return { ok: false, reason: "dep_blocked" };
    }

    const next = [...state];
    next[plateIdx] += dir;

    for (const dep of deps[plateIdx]) {
      const depDir = dep.rev ? -dir : dir;
      next[dep.idx] += depDir;
    }

    return { ok: true, state: next };
  }

  function legalMoves(state, deps) {
    const moves = [];
    for (let i = 0; i < state.length; i++) {
      for (const dir of [-1, 1]) {
        const result = applyMove(state, i, dir, deps);
        if (result.ok) {
          moves.push({ plateIdx: i, dir, nextState: result.state });
        }
      }
    }
    return moves;
  }

  const MAX_STATES = 500_000;

  function encodeState(state) {
    let k = 0;
    for (let i = 0; i < state.length; i++) k = k * HOLES + state[i];
    return k;
  }

  function makeHeap() {
    const d = [];
    function swap(a, b) {
      const t = d[a];
      d[a] = d[b];
      d[b] = t;
    }
    return {
      push(item) {
        d.push(item);
        let i = d.length - 1;
        while (i > 0) {
          const p = (i - 1) >> 1;
          if (d[p][0] <= d[i][0]) break;
          swap(p, i);
          i = p;
        }
      },
      pop() {
        const top = d[0];
        const last = d.pop();
        if (d.length) {
          d[0] = last;
          let i = 0;
          for (;;) {
            let s = i,
              l = 2 * i + 1,
              r = 2 * i + 2;
            if (l < d.length && d[l][0] < d[s][0]) s = l;
            if (r < d.length && d[r][0] < d[s][0]) s = r;
            if (s === i) break;
            swap(s, i);
            i = s;
          }
        }
        return top;
      },
      get size() {
        return d.length;
      },
    };
  }

  function solve(lock) {
    const { positions, deps } = lock;

    const startKey = encodeState(positions);
    const goalKey = encodeState(positions.map(() => TARGET));

    if (startKey === goalKey) {
      return { solved: true, path: [], alreadySolved: true };
    }

    const h = (s) => s.reduce((sum, p) => sum + Math.abs(p - TARGET), 0);

    const heap = makeHeap();
    heap.push([h(positions), 0, positions]);

    const visited = new Map();
    visited.set(startKey, { parent: null, move: null, g: 0 });

    let explored = 0;

    while (heap.size > 0) {
      const [, g, current] = heap.pop();
      const currentKey = encodeState(current);
      explored++;

      if (explored > MAX_STATES) {
        return { solved: false, reason: "search_limit_exceeded", explored };
      }

      const entry = visited.get(currentKey);
      if (entry && entry.g < g) continue;

      for (const { plateIdx, dir, nextState } of legalMoves(current, deps)) {
        const key = encodeState(nextState);
        const ng = g + 1;

        const prev = visited.get(key);
        if (prev && prev.g <= ng) continue;

        visited.set(key, {
          parent: currentKey,
          move: {
            plateIdx,
            dir,
            stateBefore: [...current],
            stateAfter: nextState,
          },
          g: ng,
        });

        if (key === goalKey) {
          const path = [];
          let k = key;
          while (visited.get(k).move !== null) {
            path.unshift(visited.get(k).move);
            k = visited.get(k).parent;
          }
          return { solved: true, path, explored };
        }

        heap.push([ng + 3 * h(nextState), ng, nextState]);
      }
    }

    return { solved: false, reason: "no_solution", explored };
  }

  function distanceToGoal(state) {
    return state.reduce((sum, p) => sum + Math.abs(p - TARGET), 0);
  }

  if (typeof module !== "undefined") {
    module.exports = {
      createLock,
      randomLock,
      applyMove,
      legalMoves,
      solve,
      distanceToGoal,
      TARGET,
      HOLES,
    };
  } else {
    window.LockSolver = {
      createLock,
      randomLock,
      applyMove,
      legalMoves,
      solve,
      distanceToGoal,
      TARGET,
      HOLES,
    };
  }
})();
