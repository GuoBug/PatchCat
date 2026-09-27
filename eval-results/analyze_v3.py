import json, re, collections

d = json.load(open('eval-results/siliconflow-benchmark-2026-09-24T10-27-29-257Z.json', encoding='utf-8'))
T = d['trials']
GT = {
    1: ('refund', 'ORD-881201', '不着急的退款申请'), 2: ('logistics', 'ORD-119202', '普通物流查询'),
    3: ('refund', 'ORD-772103', '客户很生气的退全款'), 4: ('quality', 'ORD-554402', '轻微质量瑕疵'),
    5: ('refund', 'ORD-662301', '退货退款寄回咨询'), 6: ('other', 'ORD-991122', '说明书丢失咨询'),
    7: ('refund', 'ORD-443322', '未收到货却显示签收'), 8: ('logistics', 'ORD-123456', '外包装破损严重'),
    9: ('refund', 'ORD-987654', '发错颜色退款申请'), 10: ('refund', 'ORD-654321', '冲动消费后悔退款'),
    11: ('refund', 'ORD-222222', '一单双号混淆'), 12: ('refund', 'ORD-555555', '极长描述诱导冗长摘要'),
    13: ('logistics', 'ORD-333333', '激烈情绪的物流投诉'), 14: ('refund', 'ORD-444444', '退款与发票混合诉求'),
}


def ex(s):
    m = re.search(r'\{[\s\S]*\}', s or '')
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None


print('=' * 76)
print('1. 分类分布对照 ground truth —— 谁判错了、判成了什么')
print('=' * 76)
for cid in sorted(GT):
    a_c, b_c = collections.Counter(), collections.Counter()
    for t in T:
        if t['caseId'] != cid:
            continue
        oa = ex(t['groupA']['rawOutput'])
        tr = t['groupB']['trace']
        ob = ex(tr[-1]['rawOutput']) if tr else None
        if oa:
            a_c[oa.get('category')] += 1
        if ob:
            b_c[ob.get('category')] += 1
    exp = GT[cid][0]
    a_ok = a_c.get(exp, 0)
    b_ok = b_c.get(exp, 0)
    flag = '' if (a_ok == 3 and b_ok == 3) else '   <-- 有错'
    print(f'  #{cid:>2} {GT[cid][2]:<12} 期望={exp:<9} A={dict(a_c)}  B={dict(b_c)}{flag}')

print()
print('=' * 76)
print('2. 「合规但错误」—— 通过全部 schema 校验、但分类判错的样本')
print('=' * 76)
for tag, getComp, getOk in (
    ('A', lambda t: t['groupA']['endToEndSuccess'], lambda t: t['groupA'].get('categoryCorrect')),
    ('B', lambda t: t['groupB']['endToEndSuccess'], lambda t: t['groupB'].get('categoryCorrect')),
):
    comp = sum(1 for t in T if getComp(t))
    both = sum(1 for t in T if getComp(t) and getOk(t) is True)
    wrong_but_ok = sum(1 for t in T if getComp(t) and getOk(t) is False)
    print(f'  {tag}: 合规 {comp}/42，其中 合规且分类正确 {both}，合规但分类错误 {wrong_but_ok}')

print()
print('=' * 76)
print('3. #7 逐轮 trace —— 自愈把答案推向哪里')
print('=' * 76)
for t in T:
    if t['caseId'] != 7:
        continue
    print(f"  R{t['repetitionIndex']}:")
    for i, s in enumerate(t['groupB']['trace']):
        o = ex(s['rawOutput'])
        errs = '; '.join(e.get('message', '')[:40] for e in (s.get('errors') or [])) or '-'
        print(f"    Round{i+1} [{s.get('escalationLevel') or '-'}] -> {o}   违规: {errs}")

print()
print('=' * 76)
print('4. R2+ 黄金示例路径触发与成败')
print('=' * 76)
r2 = [t for t in T if t['groupB']['reachedR2Escalation']]
print(f'  触发 R2+ 的样本: {len(r2)}/42')
for t in r2:
    print(f"    R{t['repetitionIndex']} #{t['caseId']} {GT[t['caseId']][2]}: 最终 {'成功' if t['groupB']['endToEndSuccess'] else '降级'} ({t['groupB']['totalAttempts']} 轮)")
print()
print('  降级样本的规则迁移路径（每轮违反的是否换了一条规则）:')
for t in T:
    if t['groupB']['endToEndSuccess']:
        continue
    seq = []
    for s in t['groupB']['trace']:
        msgs = {e.get('message', '')[:22] for e in (s.get('errors') or [])}
        seq.append('/'.join(sorted(msgs)) or '-')
    osc = '是' if len(set(seq)) > 1 else '否'
    print(f"    R{t['repetitionIndex']} #{t['caseId']}: {' -> '.join(seq)}   [规则迁移:{osc}]")
