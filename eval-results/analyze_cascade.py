import json, collections

d = json.load(open('eval-results/model-routing-benchmark-2026-10-01T04-17-37-319Z.json', encoding='utf-8'))
B = d['baseline']
C = d['cascade']
br = {r['caseId']: r for r in B['results']}
cr = {r['caseId']: r for r in C['results']}

print('baseline result keys:', list(next(iter(br.values())).keys()))
print('cascade  result keys:', list(next(iter(cr.values())).keys()))
print()

print('=' * 96)
print('逐用例对照（expected | baseline | cascade）')
print('=' * 96)
hdr = f"{'ID':<4}{'expected':<11}{'base_cat':<11}{'casc_cat':<11}{'base_ok':<9}{'casc_ok':<9}{'route':<22}{'escalated'}"
print(hdr)
flips = []
for cid in sorted(br):
    b, c = br[cid], cr[cid]
    bok = b.get('categoryCorrect')
    cok = c.get('categoryCorrect')
    if bok != cok:
        flips.append(cid)
    print(f"{cid:<4}{b.get('expectedCategory',''):<11}{str(b.get('actualCategory')):<11}{str(c.get('actualCategory')):<11}"
          f"{str(bok):<9}{str(cok):<9}{str(c.get('routeReason')):<22}{c.get('modelTier')}")
print()
print('分类结果发生变化的用例:', flips)
print()

print('=' * 96)
print('#7 深度对比（报告称 A 对 B 错，但两组都用 Qwen）')
print('=' * 96)
for tag, r in (('baseline', br[7]), ('cascade', cr[7])):
    print(f'  --- {tag} ---')
    print('   ', json.dumps(r, ensure_ascii=False)[:900])
print()

print('=' * 96)
print('F7 相关用例 (#27, #30)')
print('=' * 96)
for cid in (27, 30):
    for tag, r in (('baseline', br[cid]), ('cascade', cr[cid])):
        print(f'  #{cid} {tag}: expected={r.get("expectedCategory")} actual={r.get("actualCategory")} '
              f'ok={r.get("categoryCorrect")} tier={r.get("modelTier")} route={r.get("routeReason")}')
print()

print('=' * 96)
print('路由原因分布')
print('=' * 96)
print('  cascade:', dict(collections.Counter(r.get('routeReason') for r in cr.values())))
print('  baseline:', dict(collections.Counter(r.get('routeReason') for r in br.values())))
print()

print('=' * 96)
print('升级到 Tier2 的用例最终结果')
print('=' * 96)
for cid, r in sorted(cr.items()):
    if r.get('modelTier') and 'tier2' in str(r.get('modelTier')):
        print(f'  #{cid}: expected={r.get("expectedCategory")} actual={r.get("actualCategory")} '
              f'ok={r.get("categoryCorrect")} schema={r.get("schemaCompliant")} route={r.get("routeReason")}')

print()
print('=' * 96)
print('汇总数值复核')
print('=' * 96)
for tag, X in (('baseline', B), ('cascade', C)):
    rs = X['results']
    n = len(rs)
    print(f'  {tag}: n={n}')
    print(f'    schemaCompliant  {sum(1 for r in rs if r.get("schemaCompliant"))}/{n}')
    print(f'    categoryCorrect  {sum(1 for r in rs if r.get("categoryCorrect"))}/{n}')
    print(f'    orderIdCorrect   {sum(1 for r in rs if r.get("orderIdCorrect"))}/{n}')
    print(f'    tier2 数量       {sum(1 for r in rs if "tier2" in str(r.get("modelTier")))}')
    print(f'    记录的总 tokens  {sum(int(r.get("tokens") or 0) for r in rs)}  (报告声明 {X.get("totalTokensUsed")})')
    print(f'    平均耗时         {sum(int(r.get("durationMs") or 0) for r in rs)/n:.0f}ms  (报告声明 {X.get("avgDurationMs")}ms)')
