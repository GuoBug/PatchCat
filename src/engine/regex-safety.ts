/**
 * Heuristic guard against catastrophic-backtracking regexes (ReDoS).
 *
 * JS has no regex timeout, so this rejects the classic dangerous shapes before compiling:
 *   - nested quantifiers:   (a+)+   (a*)*   (a+){2,}   (.*a){10}
 *   - quantified alternation with repeated overlap: (a|a)+  (a|aa)+
 *
 * Limits: it is a heuristic, not a proof. It can reject some safe patterns and cannot catch
 * every adversarial one. The length caps in evaluateCondition remain the second line of defense.
 */

// A group whose body already contains a quantifier, itself followed by a quantifier.
const NESTED_QUANTIFIER = /\((?:[^()\\]|\\.)*[+*](?:[^()\\]|\\.)*\)\s*(?:[+*]|\{\d+,?\d*\})/;
// Quantified group with alternation of identical or prefix-overlapping branches.
const QUANTIFIED_ALTERNATION = /\(([^()|\\]+)\|([^()|\\]+)\)\s*[+*]/;

export function isUnsafeRegexPattern(pattern: string): boolean {
  if (NESTED_QUANTIFIER.test(pattern)) return true;
  const alt = QUANTIFIED_ALTERNATION.exec(pattern);
  if (alt) {
    const [, a, b] = alt;
    if (a === b || a!.startsWith(b!) || b!.startsWith(a!)) return true;
  }
  return false;
}
