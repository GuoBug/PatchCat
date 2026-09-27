"""Simulate the 'freeze satisfied fields' policy on the recorded traces.

For every degraded sample, compare consecutive rounds and report:
  - which fields CHANGED
  - whether that field was flagged as violating in the previous round
  - => drift (changed while not flagged) vs legitimate fix (changed while flagged)
"""
import json, re

d = json.load(open('eval-results/siliconflow-benchmark-2026-09-24T10-27-29-257Z.json', encoding='utf-8'))
T = d['trials']
FIELDS = ['urgency', 'category', 'summary', 'orderId']


def ex(s):
    m = re.search(r'\{[\s\S]*\}', s or '')
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None


def violating_paths(step):
    return {e.get('path') for e in (step.get('errors') or [])}


print('=' * 92)
print('冻结策略仿真：只改被点名的违规字段，其余字段必须与上一轮字面相同')
print('=' * 92)

drift_cases = 0
legit_cases = 0
for t in T:
    if t['groupB']['endToEndSuccess']:
        continue
    tr = t['groupB']['trace']
    print(f"\n[R{t['repetitionIndex']} #{t['caseId']} {t['caseTitle']}]")
    for i in range(1, len(tr)):
        prev, cur = tr[i - 1], tr[i]
        op, oc = ex(prev['rawOutput']), ex(cur['rawOutput'])
        if not op or not oc:
            print(f"   Round{i}->{i+1}: 无法解析，跳过")
            continue
        vpaths = violating_paths(prev)
        changed = [f for f in FIELDS if op.get(f) != oc.get(f)]
        for f in changed:
            flagged = f in vpaths
            kind = '合法修复（该字段上轮被点名）' if flagged else '★ 漂移（上轮未被点名却被改）'
            if flagged:
                legit_cases += 1
            else:
                drift_cases += 1
            pv = str(op.get(f))
            cv = str(oc.get(f))
            print(f"   R{i}->{i+1} 字段[{f}]: {pv[:34]} -> {cv[:34]}  {kind}")
        print(f"     上轮被点名路径: {sorted(vpaths)}")

print()
print('=' * 92)
print(f'汇总：合法修复 {legit_cases} 次，漂移 {drift_cases} 次')
print('=' * 92)

print()
print('=' * 92)
print('关键反问：#7 上冻结 category 会怎样？')
print('=' * 92)
for t in T:
    if t['caseId'] != 7:
        continue
    tr = t['groupB']['trace']
    prev = tr[0]
    op = ex(prev['rawOutput'])
    vpaths = violating_paths(prev)
    print(f"  R{t['repetitionIndex']} 首轮输出: {op}")
    print(f"     被点名路径: {sorted(vpaths)}")
    print(f"     未被点名（=> 会被冻结）: {sorted(set(FIELDS) - vpaths)}")
    print(f"     ground truth = refund，但 model 给的是 {op.get('category')}")
    print(f"     => 冻结会把错误的 category='logistics' 锁死 3 轮，自愈成功率 0/3")
    break

print()
print('=' * 92)
print('对立面：#11 的 urgency 漂移，冻结确实能救')
print('=' * 92)
for t in T:
    if t['caseId'] != 11 or t['repetitionIndex'] != 1:
        continue
    tr = t['groupB']['trace']
    for i, s in enumerate(tr):
        o = ex(s['rawOutput'])
        print(f"  Round{i+1}: urgency={o.get('urgency')} category={o.get('category')} summary={str(o.get('summary'))[:26]}")
        print(f"           被点名: {sorted(violating_paths(s))}")
    print("  => urgency 从未被点名，却从 4 漂到 5，最后撞上 logistics 上限 → 冻结能掐掉这条路径")
    break
