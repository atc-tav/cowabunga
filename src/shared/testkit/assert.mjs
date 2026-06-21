// Tiny assertion collector for scenarios — records pass/fail with detail
// instead of throwing, so one scenario can report many checks.
export function makeChecks() {
  const checks = [];
  return {
    ok(name, cond, detail = '') {
      checks.push({ name, pass: Boolean(cond), detail: cond ? '' : detail });
    },
    eq(name, actual, expected) {
      const pass = JSON.stringify(actual) === JSON.stringify(expected);
      checks.push({
        name,
        pass,
        detail: pass ? '' : `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`,
      });
    },
    approx(name, actual, expected, tol = 0.01) {
      const pass = Math.abs(actual - expected) <= tol;
      checks.push({ name, pass, detail: pass ? '' : `got ${actual}, want ~${expected}` });
    },
    results: () => checks,
  };
}
