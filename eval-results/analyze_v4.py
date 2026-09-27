import json, re, glob, os

NEW = 'eval-results/siliconflow-benchmark-2026-09-24T11-15-56-166Z.json'
OLD = 'eval-results/siliconflow-benchmark-2026-09-24T10-27-29-257Z.json'

GT = {
    1: ('refund', 'ORD-881201'), 2: ('logistics', 'ORD-119202'), 3: ('refund', 'ORD-772103'),
    4: ('quality', 'ORD-554402'), 5: ('refund', 'ORD-662301'), 6: ('other', 'ORD-991122'),
    7: ('refund', 'ORD-443322'), 8: ('logistics', 'ORD-123456'), 9: ('refund', 'ORD-987654'),
    10: ('refund', 'ORD-654321'), 11: ('refund', 'ORD-222222'), 12: ('refund', 'ORD-555555'),
    13: ('logistics', 'ORD-333333'), 14: ('refund', 'ORD-444444'),
}


def ex(s):
    m = re.search(r'\{[\s\S]*\}', s or '')
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None


def load(p):
    return json.load(open(p, encoding='utf-8'))['trials']


new, old = load(NEW), load(OLD)

print('=' * 84)
print('假设 1：orderId 漂移是否归零？（步骤 1 的独占观测信号）')
print('=' * 84)
for tag, T in (('v3 (修复前)', old), ('v4 (修复后)', new)):
    ok = n = 0
    drift = []
    for t in T:
        tr = t['groupB']['trace']
        for i, s in enumerate(tr):
            o = ex(s['rawOutput'])
            if not o:
                continue
            n += 1
            if str(o.get('orderId')).upper() == GT[t['caseId']][1]:
                ok += 1
            else:
                drift.append((t['repetitionIndex'], t['caseId'], i + 1, o.get('orderId')))
    print(f'  {tag}: B 组逐轮 orderId 正确 {ok}/{n}')
    for d in drift:
        print(f'      漂移: R{d[0]} #{d[1]} Round{d[2]} -> {d[3]}')

print()
print('=' * 84)
print('假设 2：#7 是否仍执意把 refund 改成 logistics？（步骤 2 的独占观测信号）')
print('=' * 84)
for tag, T in (('v3 (修复前)', old), ('v4 (修复后)', new)):
    for t in T:
        if t['caseId'] != 7:
            continue
        seq = []
        for s in t['groupB']['trace']:
            o = ex(s['rawOutput'])
            seq.append(f"{o.get('category')}/{o.get('urgency')}" if o else 'X')
        print(f"  {tag} R{t['repetitionIndex']}: {' -> '.join(seq)}   最终正确={t['groupB'].get('categoryCorrect')}")
    print()

print('=' * 84)
print('#11 逐轮轨迹对比（振荡 vs 卡死）')
print('=' * 84)
for tag, T in (('v3', old), ('v4', new)):
    for t in T:
        if t['caseId'] != 11:
            continue
        print(f"  {tag} R{t['repetitionIndex']}:")
        for i, s in enumerate(t['groupB']['trace']):
            o = ex(s['rawOutput'])
            errs = '; '.join((e.get('message') or '')[:26] for e in (s.get('errors') or []))
            print(f"     R{i+1} {o}  | 违规: {errs}")
    print()

print('=' * 84)
print('黄金示例实际内容（检查占位符是否自身违规）')
print('=' * 84)
for t in new:
    if t['caseId'] != 11 or t['repetitionIndex'] != 1:
        continue
    for i, s in enumerate(t['groupB']['trace']):
        fp = s.get('feedbackPrompt') or ''
        m = re.search(r'\{[\s\S]*?\n\}', fp)
        print(f'  R{i+1} escalation={s.get("escalationLevel")}')
        if m:
            print('     示例块:', m.group(0).replace('\n', ' ')[:200])
    break

print()
print('=' * 84)
print('汇总指标 v3 vs v4')
print('=' * 84)
for tag, T, d in (('v3', old, json.load(open(OLD, encoding='utf-8'))), ('v4', new, json.load(open(NEW, encoding='utf-8')))):
    s = d['summary']
    print(f"  {tag}: B 合规 {s['groupB']['endToEndRate']} | 自愈转化 {s['groupB']['healingConversion']} | "
          f"分类准确 {s['groupB']['categoryAccuracy']} | orderId {s['groupB']['orderIdAccuracy']} | "
          f"降级样本 {T and sum(1 for t in T if not t['groupB']['endToEndSuccess'])}")
    print(f"       A 合规 {s['groupA']['endToEndRate']} | 分类准确 {s['groupA']['categoryAccuracy']} | "
          f"显著性(样本/用例) {s['significance']['mcnemarBySample']:.4f}/{s['significance']['mcnemarByCase']:.4f}")
