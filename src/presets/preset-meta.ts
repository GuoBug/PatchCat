import type { Language } from '../i18n/translations.ts';

export type TemplateCategory = 'all' | 'rag' | 'routing' | 'eval' | 'api' | 'agent';

export interface TemplateMetadata {
  key: string;
  category: TemplateCategory;
  name: string;
  shortDesc: string;
  scenario: string;
  pipelineCapsules: string[];
  tags: string[];
  difficulty: string;
  icon: string;
}

export interface CategoryInfo {
  id: TemplateCategory;
  name: string;
  icon: string;
}

export const TEMPLATE_CATEGORIES: Record<Language, CategoryInfo[]> = {
  zh: [
    { id: 'all', name: '全部场景', icon: '📁' },
    { id: 'rag', name: '知识库与 RAG 质检', icon: '📚' },
    { id: 'routing', name: '智能客服与分流', icon: '🔀' },
    { id: 'eval', name: '模型竞技与研报自省', icon: '⚖️' },
    { id: 'api', name: '三方 API 与外部集成', icon: '🌐' },
    { id: 'agent', name: '自主智能体与工具调用', icon: '🤖' },
  ],
  en: [
    { id: 'all', name: 'All Scenarios', icon: '📁' },
    { id: 'rag', name: 'Knowledge & RAG Auditor', icon: '📚' },
    { id: 'routing', name: 'Routing & Customer Triage', icon: '🔀' },
    { id: 'eval', name: 'Arena Eval & Critic Loop', icon: '⚖️' },
    { id: 'api', name: 'API & Integrations', icon: '🌐' },
    { id: 'agent', name: 'Autonomous Agents & Tools', icon: '🤖' },
  ],
};

export const TEMPLATES_META: Record<Language, Record<string, TemplateMetadata>> = {
  zh: {
    'rag-agentic-auditor': {
      key: 'rag-agentic-auditor',
      category: 'rag',
      name: '知识库增强方案生成与合规质检流',
      shortDesc: '双阶段 Agentic RAG：知识召回 ➔ 方案起草 ➔ 独立事实质检 ➔ 报告输出',
      scenario: '针对企业级技术与咨询方案撰写，先从私有知识库检索高相关文档分块，再由专家模型起草方案，随后交由独立审计官逐项对照原文质检，彻底杜绝胡言乱语与合规风险。',
      pipelineCapsules: ['业务入参', '知识库检索', '初稿起草', '事实合规质检', '交付报告'],
      tags: ['稠密向量召回', '双模型质检', 'Zero-Hallucination', '企业级研报'],
      difficulty: '专家',
      icon: '📚',
    },
    'rag-qa': {
      key: 'rag-qa',
      category: 'rag',
      name: 'RAG 知识库增强精准问答',
      shortDesc: '标准企业级私有知识库检索与 Grounded 精准回答',
      scenario: '连接内部技术文档与产品手册，根据提问进行语义相似度检索，并将高置信度召回片段作为 Context 注入 Prompt，生成带来源引用的可靠答案。',
      pipelineCapsules: ['用户提问', '知识库语义检索', '上下文拼装', '精准生成'],
      tags: ['知识问答', 'Top-K 语义匹配', '精准引用'],
      difficulty: '入门',
      icon: '📖',
    },
    'customer-support': {
      key: 'customer-support',
      category: 'routing',
      name: '智能客服意图识别与工单路由',
      shortDesc: '多维意图分类 ➔ 紧急度判定 ➔ 自动工单派发与流转',
      scenario: '全量接收入口客服工单或咨询，大模型精准识别用户意图（技术故障/退款投诉/售后建议），判定优先级并自动分派至对应专员分支，显著减少人工初筛成本。',
      pipelineCapsules: ['工单输入', '意图识别与打分', '优先级路由', '工单派发'],
      tags: ['工单自动化', '意图分类', '降本增效'],
      difficulty: '入门',
      icon: '🎧',
    },
    'conditional-routing': {
      key: 'conditional-routing',
      category: 'routing',
      name: '智能客服多分支条件路由与聚合',
      shortDesc: 'IF/ELSE 规则分流 ➔ 动态分支跳过 ➔ 多路结果汇聚',
      scenario: '当工作流中需要根据业务评分或用户类型走向不同处理链条时，条件分支精准过滤，未激活链路自动剪枝，最终由聚合节点平滑汇聚多分支数据。',
      pipelineCapsules: ['入参校验', '条件判定 (IF/ELSE)', '差异化处理', '多路汇聚'],
      tags: ['逻辑分支', '状态剪枝', '多路汇聚'],
      difficulty: '进阶',
      icon: '🔀',
    },
    'report-critic': {
      key: 'report-critic',
      category: 'eval',
      name: '自反思研报生成与 Critic 优化',
      shortDesc: '初稿生成 + 专家评审 + 终稿润色闭环链路',
      scenario: '模拟两名专家的工作流：先由撰写模型根据大纲输出深度研报初稿，再由挑剔的 Critic 审查模型给出打分与修订意见，最后合成无可挑剔的高质量成品。',
      pipelineCapsules: ['研究主题', '初稿起草', 'Critic 反思评审', '终稿精修'],
      tags: ['Self-Reflective', '多 Agent 协作', '长文撰写'],
      difficulty: '进阶',
      icon: '📝',
    },
    'model-arena': {
      key: 'model-arena',
      category: 'eval',
      name: '多大模型横向盲测与裁判打分',
      shortDesc: '多模型并发评测与 LLM-as-a-Judge 自动化打分',
      scenario: '相同输入下并行向不同模型（如 GPT-4o、Claude 3.5、DeepSeek-V3）发起请求，最后通过中立 Judge 裁判节点进行对比维度打分，选出最适合特定任务的模型。',
      pipelineCapsules: ['评测 Prompt', '多模型并发生成', '聚合响应', '裁判盲审打分'],
      tags: ['LLM 竞技场', '模型横评', '并发调度'],
      difficulty: '进阶',
      icon: '⚖️',
    },
    'weather-api': {
      key: 'weather-api',
      category: 'api',
      name: '外部实时天气 API 调度与早报播报',
      shortDesc: '三方 HTTP REST API 实时调用 ➔ 数据解析 ➔ 贴心早报总结',
      scenario: '接入真实世界公网 API，发送 GET 请求获取城市实时天气与空气质量数据，通过 Code 节点清洗关键指标，再由 LLM 输出兼具温度与关怀的出行建议早报。',
      pipelineCapsules: ['城市入参', 'HTTP GET 请求', '数据清洗', '关怀早报播报'],
      tags: ['REST API', '数据管道', '外部集成'],
      difficulty: '入门',
      icon: '🌐',
    },
    'agent-tool-calling': {
      key: 'agent-tool-calling',
      category: 'agent',
      name: '自主智能体工具调用与运算流',
      shortDesc: 'ReAct 自主循环调用汇率与运算工具，自主决策终态',
      scenario: '赋予大模型自主使用外部工具的能力。Agent 自行推导当前缺少的信息，主动调用外汇查询与复杂数学计算工具，拿到结果后再综合给出专业解答。',
      pipelineCapsules: ['复杂任务', '思维链推理 (ReAct)', '工具分派执行', '最终决策结果'],
      tags: ['Agentic', 'Function Calling', '自主规划'],
      difficulty: '专家',
      icon: '🤖',
    },
  },
  en: {
    'rag-agentic-auditor': {
      key: 'rag-agentic-auditor',
      category: 'rag',
      name: 'Enterprise RAG: Proposal & Compliance Auditor',
      shortDesc: 'Dual-Stage Agentic RAG: Recall ➔ Drafting ➔ Independent Audit ➔ Final Report',
      scenario: 'For enterprise technical proposals and audit reports: retrieves high-relevance chunks from knowledge base, drafts the initial proposal, and runs an independent auditor node to cross-verify citations, eliminating hallucinations.',
      pipelineCapsules: ['Input Payload', 'KB Retrieval', 'Draft Proposal', 'Compliance Audit', 'Final Deliverable'],
      tags: ['Vector Recall', 'Dual-LLM Audit', 'Zero-Hallucination', 'Enterprise RAG'],
      difficulty: 'Advanced',
      icon: '📚',
    },
    'rag-qa': {
      key: 'rag-qa',
      category: 'rag',
      name: 'RAG Grounded Q&A',
      shortDesc: 'Standard Knowledge Base Semantic Search & Grounded Answer',
      scenario: 'Connects internal documentation, performs semantic similarity matching based on user query, injects top-k chunks into prompt context, and returns grounded, cited answers.',
      pipelineCapsules: ['User Query', 'KB Semantic Search', 'Context Assemble', 'Grounded Answer'],
      tags: ['Knowledge Base', 'Top-K Retrieval', 'Source Citation'],
      difficulty: 'Starter',
      icon: '📖',
    },
    'customer-support': {
      key: 'customer-support',
      category: 'routing',
      name: 'Customer Support Routing',
      shortDesc: 'Multi-dimensional Intent Classification & Ticket Triage',
      scenario: 'Triages incoming support inquiries with LLM intent analysis (technical bug, billing, feature request), evaluates urgency, and routes directly to the appropriate team branch.',
      pipelineCapsules: ['Ticket Input', 'Intent & Urgency Score', 'Branch Triage', 'Agent Dispatch'],
      tags: ['Support Automation', 'Intent Triage', 'Productivity'],
      difficulty: 'Starter',
      icon: '🎧',
    },
    'conditional-routing': {
      key: 'conditional-routing',
      category: 'routing',
      name: 'Conditional Customer Routing & Aggregation',
      shortDesc: 'IF/ELSE Branch Routing ➔ Dynamic Skipping ➔ Multi-Path Aggregation',
      scenario: 'Dynamically routes execution paths based on custom rules, skips dormant branches, and aggregates multi-path results cleanly into downstream consumers.',
      pipelineCapsules: ['Input Check', 'Condition (IF/ELSE)', 'Branch Processing', 'Aggregator Join'],
      tags: ['Branching', 'State Pruning', 'Aggregator'],
      difficulty: 'Intermediate',
      icon: '🔀',
    },
    'report-critic': {
      key: 'report-critic',
      category: 'eval',
      name: 'Report Generator with Critic Loop',
      shortDesc: 'Draft Generation + Expert Critic Review + Polish',
      scenario: 'Simulates a two-expert editorial pipeline: a writer LLM drafts the report, a rigorous critic LLM evaluates clarity and omissions, and a final synthesizer polishes the text.',
      pipelineCapsules: ['Topic Input', 'Draft Writer', 'Critic Review', 'Polished Deliverable'],
      tags: ['Self-Reflective', 'Multi-Agent', 'Long-form Content'],
      difficulty: 'Intermediate',
      icon: '📝',
    },
    'model-arena': {
      key: 'model-arena',
      category: 'eval',
      name: 'Multi-LLM Arena & Benchmark Judge',
      shortDesc: 'Side-by-Side Model Benchmark with LLM-as-a-Judge',
      scenario: 'Runs concurrent prompts against multiple models (GPT-4o, Claude 3.5, DeepSeek-V3), and uses an impartial judge node to score outputs across dimensions to pick the winner.',
      pipelineCapsules: ['Benchmark Prompt', 'Concurrent Generation', 'Gather Responses', 'Judge Evaluation'],
      tags: ['LLM Arena', 'Benchmark', 'Parallel Dispatch'],
      difficulty: 'Intermediate',
      icon: '⚖️',
    },
    'weather-api': {
      key: 'weather-api',
      category: 'api',
      name: 'Weather API Integration & Advisory',
      shortDesc: 'External HTTP REST API ➔ JSON Parsing ➔ Contextual Morning Briefing',
      scenario: 'Fetches live city weather and AQI via REST API, formats payload with a Code node, and passes structured metrics to an LLM to generate an empathetic morning advisory.',
      pipelineCapsules: ['City Target', 'HTTP GET Request', 'Payload Cleanse', 'Advisory Summary'],
      tags: ['REST API', 'Data Pipeline', 'External Integrations'],
      difficulty: 'Starter',
      icon: '🌐',
    },
    'agent-tool-calling': {
      key: 'agent-tool-calling',
      category: 'agent',
      name: 'Autonomous Agent with Tool Calling',
      shortDesc: 'ReAct Loop Autonomous Decision Making with Calculator & Lookup',
      scenario: 'Equips LLMs with external tools. The agent reasons about missing data, iteratively invokes financial conversion and arithmetic tools, and delivers a consolidated answer.',
      pipelineCapsules: ['Complex Task', 'ReAct Reasoning', 'Tool Invocation', 'Final Resolution'],
      tags: ['Agentic', 'Function Calling', 'Autonomous Reasoning'],
      difficulty: 'Advanced',
      icon: '🤖',
    },
  },
};
