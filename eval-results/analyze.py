import json, re, collections, sys

PATH = 'eval-results/siliconflow-benchmark-2026-09-24T10-01-21-487Z.json'
d = json.load(open(PATH, encoding='utf-8'))
T = d['trials']

GT = {
    1: ('refund', 'ORD-881201', '不着急的退款申请'),
    2: ('logistics', 'ORD-119202', '普通物流查询'),
    3: ('refund', 'ORD-772103', '客户很生气的退全款'),
    4: ('quality', 'ORD-554402', '轻微质量瑕疵'),
    5: ('refund', 'ORD-662301', '退货退款寄回咨询'),
    6: ('other', 'ORD-991122', '说明书丢失咨询'),
    7: ('refund', 'ORD-443322', '未收到货却显示签收'),
    8: ('logistics', 'ORD-123456', '外包装破损严重'),
    9: ('refund', 'ORD-987654', '发错颜色退款申请'),
    10: ('refund', 'ORD-654321', '冲动消费后悔退款'),
}


def extract(s):
    if not s:
        return None
    m = re.search(r'\{[\s\S]*\}', s)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None


print('=' * 78)
print('A. 跨字段规则触发核查：refund 但 urgency < 4  (本实验的核心不变量)')
print('=' * 78)
viol = 0
for t in T:
    cid = t['caseId']
    exp_cat = GT[cid][0]
    oa = extract(t['groupA']['rawOutput'])
    trB = t['groupB']['trace']
    ob = extract(trB[0]['rawOutput']) if trB else None
    for tag, o in (('A', oa), ('B-R1', ob)):
        if o and o.get('category') == 'refund' and isinstance(o.get('urgency'), int) and o['urgency'] < 4:
            viol += 1
            print(f"  R{t['repetitionIndex']} #{cid} [{tag}] category=refund urgency={o['urgency']}  <-- 违反跨字段不变量")
print(f'  总计跨字段违规次数: {viol}  (0 表示该规则从未被触发)')
print()

print('=' * 78)
print('B. urgency 取值分布  (按期望分类拆分)')
print('=' * 78)
for tag, get in (('A', lambda t: extract(t['groupA']['rawOutput'])),
                 ('B-首轮', lambda t: extract(t['groupB']['trace'][0]['rawOutput']) if t['groupB']['trace'] else None)):
    print(f'  --- {tag} ---')
    for cid in sorted(GT):
        vals = []
        for t in T:
            if t['caseId'] != cid:
                continue
            o = get(t)
            vals.append(o.get('urgency') if o else 'X')
        print(f"    #{cid:>2} {GT[cid][2]:<12} 期望={GT[cid][0]:<9} 实得 urgency={vals}")
print()

print('=' * 78)
print('C. 分类准确率 (对照 ground truth) —— 当前脚本未测量的维度')
print('=' * 78)
for tag, get in (('A', lambda t: extract(t['groupA']['rawOutput'])),
                 ('B-最终轮', lambda t: extract(t['groupB']['trace'][-1]['rawOutput']) if t['groupB']['trace'] else None)):
    ok = 0
    n = 0
    wrong = collections.Counter()
    for t in T:
        o = get(t)
        if not o:
            continue
        n += 1
        if o.get('category') == GT[t['caseId']][0]:
            ok += 1
        else:
            wrong[(t['caseId'], o.get('category'))] += 1
    print(f'  {tag}: {ok}/{n} = {ok / n * 100:.1f}%')
    for (cid, got), c in sorted(wrong.items()):
        print(f'      #{cid} 期望 {GT[cid][0]} -> 实得 {got}  x{c}')
print()

print('=' * 78)
print('D. B 组 L1 语法：json_object 受限解码是否真的零失败')
print('=' * 78)
rounds = 0
oks = 0
for t in T:
    for s in t['groupB']['trace']:
        rounds += 1
        if s['syntaxValid']:
            oks += 1
print(f'  B 组总轮次 {rounds}, 语法有效 {oks} -> {oks / rounds * 100:.1f}%')
print(f'  A 组语法失败 {sum(1 for t in T if not t["groupA"]["l1SyntaxOk"])}/30')
print()

print('=' * 78)
print('E. 耗时与超时')
print('=' * 78)
for t in T:
    if t['groupA']['durationMs'] > 15000 or t['groupB']['durationMs'] > 15000:
        print(f"  R{t['repetitionIndex']} #{t['caseId']}: A={t['groupA']['durationMs']}ms B={t['groupB']['durationMs']}ms")
print()

print('=' * 78)
print('F. 按用例汇总 (3 轮合并)')
print('=' * 78)
print(f"  {'#':<3}{'用例':<14}{'A端到端':<10}{'B端到端':<10}{'B拦截':<8}{'A超时/空'}")
for cid in sorted(GT):
    rs = [t for t in T if t['caseId'] == cid]
    a = sum(1 for t in rs if t['groupA']['endToEndSuccess'])
    b = sum(1 for t in rs if t['groupB']['endToEndSuccess'])
    bi = sum(1 for t in rs if t['groupB']['wasInterceptedByL2'])
    ax = sum(1 for t in rs if not t['groupA']['l1SyntaxOk'])
    print(f"  {cid:<3}{GT[cid][2]:<14}{a}/3{'':<7}{b}/3{'':<7}{bi}{'':<7}{ax}")
