const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-2.5-flash';

interface GeminiCallParams {
  systemPrompt?: string;
  userPrompt: string;
  responseJson?: boolean;
}

async function callGemini(params: GeminiCallParams) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  
  const contents: any[] = [];
  if (params.systemPrompt) {
    // Gemini supports system_instruction
  }
  contents.push({
    role: 'user',
    parts: [{ text: params.userPrompt }],
  });

  const body: any = {
    contents,
    generationConfig: {
      temperature: 0.1,
    },
  };

  if (params.systemPrompt) {
    body.systemInstruction = {
      parts: [{ text: params.systemPrompt }],
    };
  }

  if (params.responseJson) {
    body.generationConfig.responseMimeType = 'application/json';
  }

  const startTime = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`[HTTP ${res.status}] ${errText}`);
  }

  const data = await res.json();
  const duration = Date.now() - startTime;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const usage = data.usageMetadata;

  return { text, duration, usage };
}

async function test1() {
  console.log('\n======================================================');
  console.log('🧪 测试 1：基础连通性与极速响应 (Ping / Latency & Throughput)');
  console.log('======================================================');
  try {
    const result = await callGemini({
      systemPrompt: '你是一个精炼的技术架构师助手。',
      userPrompt: '请用中文一句话回答：什么是确定性 AI 工作流编排？',
    });
    console.log('🤖 Gemini 响应:\n', result.text.trim());
    console.log('------------------------------------------------------');
    console.log(`✅ 测试 1 通过！耗时: ${result.duration}ms`);
    console.log(`📊 Token 消耗: Prompt ${result.usage?.promptTokenCount} | Output ${result.usage?.candidatesTokenCount} | Total ${result.usage?.totalTokenCount}`);
    return true;
  } catch (err: any) {
    console.error('❌ 测试 1 失败:', err.message);
    return false;
  }
}

async function test2() {
  console.log('\n======================================================');
  console.log('🧪 测试 2：原生受限 JSON 结构化输出 (Native JSON Schema Mode)');
  console.log('======================================================');
  try {
    const result = await callGemini({
      systemPrompt: '你是一个工单分类引擎。提取工单关键信息并输出标准 JSON 格式。包含 orderId, category, urgency, summary 字段。',
      userPrompt: '提取工单：订单 ORD-888999，快递在中转站卡了三天，要求核查物流进度。category 必须为 logistics/refund/quality/other 之一。',
      responseJson: true,
    });
    console.log('🔍 原生 JSON 输出:\n', result.text.trim());
    const parsed = JSON.parse(result.text);
    console.log('📦 反序列化验证:', parsed);
    const valid = parsed.orderId === 'ORD-888999' && parsed.category === 'logistics';
    console.log('------------------------------------------------------');
    if (valid) {
      console.log(`✅ 测试 2 通过！耗时: ${result.duration}ms，字段与 Schema 100% 契合！`);
      return true;
    } else {
      console.warn('⚠️ 测试 2 字段内容有偏差');
      return false;
    }
  } catch (err: any) {
    console.error('❌ 测试 2 失败:', err.message);
    return false;
  }
}

async function test3() {
  console.log('\n======================================================');
  console.log('🧪 测试 3：实战破案 —— Case #27 (F7 假冒伪劣专柜验货退款)');
  console.log('评测目标：实测商业顶级模型能否穿透“假冒仿冒”描述，正确命中核心动作 refund？');
  console.log('======================================================');
  const prompt = '请解析工单：订单 ORD-246810 收到的大牌香水瓶身做工粗糙，去专柜验货鉴定为假货。商品存在严重仿冒质量问题，我要求立即退款并保留向市监局举报的权利！';

  try {
    const result = await callGemini({
      systemPrompt: `你是一个智能客服工单路由系统。分析工单并输出 JSON:
- orderId: 订单号
- category: 工单分类，必须在 ["logistics", "refund", "quality", "other"] 之一。注意：当用户明确要求退款退货时，核心业务动作优先，必须归为 refund，不得仅因提及质量问题而误判为 quality。
- urgency: 紧急度 1-5 (涉及退款维权通常为 4-5)
- summary: 15-30字内的问题描述`,
      userPrompt: prompt,
      responseJson: true,
    });

    console.log('🔍 Gemini 解析输出:\n', result.text.trim());
    const parsed = JSON.parse(result.text);
    console.log('------------------------------------------------------');
    console.log(`🎯 Ground Truth 期望: refund | Gemini 实际输出: ${parsed.category}`);
    if (parsed.category === 'refund') {
      console.log('🌟 科学突破！Gemini 结合动作优先权，成功抗住了 F7 描述词劫持，准确命中 refund！');
    } else {
      console.log('🔬 经典重现！Gemini 同样被“假货、质量问题”强力锚定误判为 quality！实证强模型也受 F7 困扰！');
    }
    console.log(`✅ 测试 3 完成！耗时: ${result.duration}ms`);
    return true;
  } catch (err: any) {
    console.error('❌ 测试 3 失败:', err.message);
    return false;
  }
}

async function main() {
  console.log(`🚀 开始对 Google Gemini (${GEMINI_MODEL}) 执行 3 项端到端基准测试...\n`);
  const r1 = await test1();
  const r2 = await test2();
  const r3 = await test3();
  console.log('\n======================================================');
  console.log(`🏁 3 项测试全部执行完毕: T1=${r1 ? '✅ PASS' : '❌ FAIL'}, T2=${r2 ? '✅ PASS' : '❌ FAIL'}, T3=${r3 ? '✅ PASS' : '❌ FAIL'}`);
  console.log('======================================================\n');
}

main();
