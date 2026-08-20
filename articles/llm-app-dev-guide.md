# 大模型应用开发实战：从意图识别到 GraphRAG 双路召回

> 一句话结论：一个可落地的 AI 应用，不是「把用户问题直接丢给大模型」，而是**先做路由分流，再用检索增强（RAG/知识图谱）喂给模型，最后用流式输出和记忆管理把它包装成产品级体验**。

本文基于四个真实项目的源码与架构文档总结而成：

| 项目 | 形态 | AI 能力 |
|---|---|---|
| 智游修记（imgFix） | HarmonyOS 原生 App | 智能客服：意图识别 + 关键词 RAG + 多模态视觉 |
| 智贸法桥（LawAreaAccess） | 微信小程序 + 云开发 | 法律咨询：本地意图 + 本地/云库双源 RAG + 法规解读 |
| 天枢便签（palarisNote） | Qt/QML 桌面应用 | 内置知识库 + 火山引擎文档分析（思维导图/周报月报） |
| 肉类食品溯源平台（market1） | Spring Boot + Vue 3 | IntentClassifier + 知识图谱/文档双路召回 GraphRAG |

文章先拆解这四个项目的共同架构，再逐层深入每个核心技术点，最后补充向量检索、Agent、评估、安全等进阶知识。

---

## 1. 总体架构：AI 应用的分层设计

四个项目技术栈完全不同（ArkTS / 小程序 / C++ / Java），但 AI 部分的**分层逻辑高度一致**，可以抽象成一张通用架构图：

```text
┌──────────────────────────────────────────────────────┐
│  UI 层（App / 小程序 / 桌面端 / Web）                  │
│  聊天窗、快捷指令按钮、模板填写、图片上传、流式渲染      │
└──────────────────────┬───────────────────────────────┘
                       │  HTTP / SSE
┌──────────────────────▼───────────────────────────────┐
│  路由层：AI 智能路由（意图识别 + 规则分流）             │
│  打招呼 → 本地快答 │ 无关话题 → 礼貌拦截 │ 溯源码 → DB  │
│  操作指南 → 本地模板 │ 业务问题 → 检索增强 → 大模型      │
└──────────────────────┬───────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────┐
│  检索层：多路召回 + 重排                              │
│  知识图谱检索（实体/关系/BFS） │ 文档检索（倒排+TF-IDF）│
│  向量检索（Embedding） │ 数据库直查（业务兜底）        │
└──────────────────────┬───────────────────────────────┘
                       │  检索结果 → 上下文组装
┌──────────────────────▼───────────────────────────────┐
│  生成层：大模型（OpenAI 兼容接口）                    │
│  系统提示词 + 历史记忆 + RAG 上下文 + 当前问题          │
│  流式输出（SSE）/ 结构化输出 / 多模态                 │
└──────────────────────┬───────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────┐
│  存储层：MySQL 业务库 │ SQLite 对话记忆 │ graph.json    │
└──────────────────────────────────────────────────────┘
```

### 1.1 分层职责

| 层 | 职责 | 典型实现 |
|---|---|---|
| UI 层 | 对话交互、快捷指令、模板、图片上传、流式渲染 | ArkTS Component、小程序 Page、QML、Vue |
| 路由层 | 判断「这个问题该怎么处理」，决定走本地还是 AI | IntentClassifier、matchIntent() |
| 检索层 | 从知识库/图谱/数据库中找到与问题相关的资料 | KnowledgeBase、DocumentStore |
| 生成层 | 基于上下文生成自然语言回答 | Volcengine Chat Completions、SSE |
| 存储层 | 业务数据、对话历史、知识图谱文件 | MySQL、SQLite、JSON |

**关键设计原则：能用规则解决的绝不动用大模型。**

智游修记的技术文档明确写了：约 60–70% 的常见交互（打招呼、致谢、功能咨询、FAQ）通过本地意图识别直接回复，**完全零 token 消耗**。这不是省钱的小技巧，而是大模型应用架构的第一性原则——大模型是最后一道工序，不是第一道工序。

---

## 2. AI 智能路由：一次对话的决策树

「智能路由」是大模型应用里最容易被低估的模块。它决定每一条用户消息的**处理路径**，直接关系到成本、延迟和回答质量。

### 2.1 路由决策树（综合四个项目）

```text
用户输入
  │
  ├─ 1. 空输入检查 ────────────────► 提示输入
  │
  ├─ 2. 硬规则匹配（最高优先级）
  │     · 溯源码正则 /TRACE\d{8,}/ ──► 直接查数据库返回
  │     · 法律要素词（国家名/法条）─► 放行到 RAG + AI
  │
  ├─ 3. 本地意图识别（关键词打分）
  │     ├─ 命中：打招呼/致谢/告别 ──► 随机本地话术（0 token）
  │     ├─ 命中：功能导航/操作指南 ──► 本地模板回复
  │     └─ 未命中 ──────────────────► 进入检索增强
  │
  ├─ 4. 意图拦截（防误判）
  │     · 业务关键词检测：含业务词则不当作闲聊
  │     · HOW_TO_USE 拦截器：问「数据怎么来的」是业务问题
  │
  └─ 5. 兜底：全部交给 RAG/GraphRAG + 大模型
```

### 2.2 路由的四种实现层级

| 层级 | 实现方式 | 优点 | 缺点 | 适用场景 |
|---|---|---|---|---|
| L0 规则 | 正则、关键词、硬编码映射 | 零成本、零延迟、确定性强 | 覆盖有限、维护量大 | 溯源码、登录口令、指令 |
| L1 打分 | 关键词精确/包含/被包含加权 | 简单可控、可调阈值 | 无法理解语义 | 意图识别、FAQ 路由 |
| L2 分类模型 | 小模型意图分类（BERT 等） | 语义理解、泛化好 | 需训练数据与部署 | 意图多、长尾多的场景 |
| L3 大模型 | LLM 判断意图（function calling） | 最强泛化 | 慢、贵、有不确定性 | 复杂 Agent 路由 |

四个项目全部采用 **L0 + L1 混合**：规则保证确定性，打分保证灵活性，大模型只处理 L1 覆盖不了的剩余问题。这是当前成本/效果比最优的工程实践。

### 2.3 放行与拦截：路由设计最关键的分寸

智贸法桥的实现给出了一个教科书级的例子：意图识别**只管闲聊和功能导航**，凡是疑似实质性法律咨询一律放行给 RAG + AI：

```javascript
// 法律要素检测：命中即放行，绝不用固定话术拦截
const LEGAL_TERMS = ['条例', '法案', '法令', '条款', '合规', '关税', '侵权', '违约金', '诉讼', ...];

function isLegalQuery(text) {
  // 命中国家名或法律要素词 → 视为实质法律咨询，直接放行 RAG + AI
}
```

注释里写得很清楚：「'法规/法律/规定/合同/协议' 等词同时也是功能导航词（查法规/合同审查），不放正则，避免拦截『查法规』『合同审查』等导航请求。」

**核心经验：拦截器要比放行器保守。** 吃不准的问题默认走 AI，宁可多花几分钱，不可答非所问。

同样，溯源平台在 GREETING 判断上加了「业务词硬拦截」：

```java
// 一、硬拦截词：出现任何一个，就绝不归类为 GREETING
String[] BUSINESS_KEYWORDS = {"企业", "公司", "养殖场", "批次", "溯源", "检疫", "品种", ...};

// 只有短文本（≤30 字）+ 纯招呼词才触发 GREETING
if (!hasBusiness && !blockedHowToUse && t.length() <= 30 && containsAny(t, GREETING_KEYWORDS)) {
    return Intent.GREETING;
}
```

以及 HOW_TO_USE 的「业务问题拦截器」：

```java
// "企业怎么注册的 / 批次怎么流转的" → 问的是业务过程，走 AI
Pattern.compile("(企业|公司|养殖场|屠宰场|批发商|零售商).{0,4}(怎么|如何|怎样).{0,6}(注册|录入|添加|生成|关联|创建)");
```

这就是路由设计的精髓：**高置信才走低成本路径，低置信一律走高质量路径。**

---

## 3. 意图识别：打分算法的工程细节

### 3.1 关键词打分规则（通用公式）

智游修记与智贸法桥使用了几乎相同的评分体系：

```text
精确匹配  (input === keyword)           → +10 分
包含匹配  (input.includes(keyword))     → +5  分
被包含    (keyword.includes(input))     → +2/+1 分（要求 input 长度 ≥ 2）
触发阈值  bestScore >= 5
```

示例（智贸法桥 matchIntent 核心逻辑）：

```javascript
for (const rule of INTENT_RULES) {
  let score = 0;
  for (const keyword of rule.keywords) {
    if (text === kw) score += 10;          // 精确
    else if (text.includes(kw)) score += 5; // 包含
    else if (kw.includes(text) && text.length >= 2) score += 1; // 被包含
  }
  if (score > bestScore) { bestScore = score; bestMatch = rule; }
}
```

### 3.2 意图规则设计要点

以智贸法桥为例，意图规则表：

| 意图 | 触发关键词示例 | 回复数 | 说明 |
|---|---|---|---|
| greeting | 你好、您好、嗨、hello、在吗 | 3 | 随机回复避免死板 |
| who_are_you | 你是谁、你能做什么、介绍你自己 | 3 | 品牌话术 |
| thanks / goodbye | 谢谢、再见、bye | 4 | 礼貌闭环 |
| risk_check | 风险自检、怎么检测风险 | 3 | 导航到功能页 |
| regulations | 查法规、怎么查法律 | 3 | 导航到法规查询 |
| contract | 合同审查、审合同 | 3 | 导航到合同审查 |
| aigc | aigc审查、内容合规 | 3 | 导航到 AIGC 审查 |
| consult | 预约咨询、找人工 | 3 | 导航到专家预约 |
| help | 帮助、教程、指南 | 3 | 使用指南 |

设计经验：

1. **每个意图 3–4 条不同风格的回复**，随机选择，避免对话「死板感」（智游修记原话）；
2. **导航类意图只对短输入生效**（如 `text.length <= 25`），长输入大概率是具体问题；
3. **意图数量控制在 8–15 个**，太多互相干扰，太少兜底压力大；
4. **把「排除条件」写进意图**——比如 greeting 必须不含业务词。

### 3.3 意图枚举设计（溯源平台版）

```java
public enum Intent {
    GREETING,      // 打招呼（本地快答）
    HOW_TO_USE,    // 询问软件如何使用（本地指南）
    IRRELEVANT,    // 无关问题（礼貌拒绝）
    TRACE_QUERY,   // 溯源码查询（直接查数据库）
    DATA_QUERY,    // 查询数据库内容（触发 RAG + AI）
    GENERAL        // 一般问题（兜底走 AI）
}
```

注意 `TRACE_QUERY` 的存在：**凡是能结构化查询的就不要走大模型**。溯源码 `TRACE20240602001` 用正则一步到位，返回的是数据库真实数据，零幻觉、零延迟。

---

## 4. RAG 检索增强生成：让大模型「有据可依」

### 4.1 为什么需要 RAG

大模型的知识截止于训练时刻，且会「一本正经地胡说八道」。RAG（Retrieval-Augmented Generation）的思路是：**先检索，再生成**——把相关知识作为上下文喂给模型，让回答有依据。

```text
用户问题
   │
   ▼
检索器（知识库/文档/FAQ/图谱）
   │  返回 Top-K 相关片段
   ▼
组装 Prompt：系统提示词 + 「检索到的资料」+ 用户问题
   │
   ▼
大模型生成回答
```

### 4.2 关键词 RAG（四个项目的主流实现）

由于项目多跑在端侧或轻量后端，四个项目都不约而同采用了**基于关键词打分的轻量 RAG**，而非向量检索。以智游修记的 `searchKnowledge()` 为例：

```text
检索域：
  1. FeatureItem[]   - 14 项功能
  2. UsageGuideItem[] - 9 项指南
  3. FAQItem[]       - 11 条 FAQ

评分规则：
  标题/名称包含查询词  → +10 分
  内容/描述包含查询词  → +5  分
  关键词包含查询词    → +3  分
  查询词包含关键词    → +2  分

输出：按分数降序，取前 5 条，以 "\n\n" 分隔
```

### 4.3 倒排索引 + TF-IDF（溯源平台 DocumentStore）

当文档数量增大，线性扫描会变慢。溯源平台实现了真正的**倒排索引 + TF-IDF 评分**：

```java
public static class DocumentStore {
    private final Map<String, List<Integer>> invertedIndex = new HashMap<>();
    // 词项 → 出现该词的段落索引列表

    // 构建：按 "##" 分块，逐段分词，写入倒排索引
    // 检索：KG 锁定的实体名 → 查倒排索引 → TF-IDF 评分 → Top-5
}
```

构建流程：

```text
15 份 Markdown 业务文档
  → 按 ## 标题分块（每个段落独立建索引）
  → 逐段分词（去掉停用词）
  → 建立 词项 → [段落索引] 的倒排映射
```

检索流程：

```text
查询实体集合（来自知识图谱）
  → 对每个实体词查倒排索引，得到候选段落
  → TF-IDF 评分：词频 × 逆文档频率（越多的 KG 实体名出现在段落中，得分越高）
  → 取 Top-5 最相关段落
```

TF-IDF 的核心思想：

```text
TF（词频）：词在段落中出现次数越多越重要
IDF（逆文档频率）：词在越少段落出现越有区分度
score(段落) = Σ 查询词 × TF × IDF
```

### 4.4 RAG 上下文的组装方式

两个项目给出了两种经典的注入姿势：

**方式一：注入 system prompt（智游修记 / 溯源平台）**

```java
String systemPrompt = "你是『东软肉类食品溯源平台』的智能助理。你必须严格基于以下知识库信息回答问题。\n"
    + ragContext + "\n\n"
    + "## 回答规则\n"
    + "1. 优先使用上面提供的数据库查询结果和统计数据\n"
    + "2. 如果用户问的问题不在知识库范围内，礼貌告知\n"
    + "3. 回答简洁专业，使用中文\n"
    + "4. 涉及具体数据时引用字段名和数值\n"
    + "5. 不要透露你是 AI 模型的内部信息";
```

**方式二：注入 user message（智贸法桥）**

```javascript
function buildRAGMessage(userMessage) {
  return `请优先依据下面检索到的法律资料回答用户问题。
资料与问题相关时，必须引用具体法律依据（条文/来源），不得编造法条；
资料不足以回答时，基于专业知识补充并说明仅供参考。

【检索到的法律资料】
${ragContext}

【用户问题】
${userMessage}`;
}
```

两种方式都强调同一件事：**「必须基于资料回答，不得编造」**。这是 RAG 应用的防幻觉三件套之一（详见第 10 节）。

### 4.5 RAG 数据源的多样性

智贸法桥的检索是「本地 + 云端双源」：

```text
searchKnowledgeAsync(query)
  ├─ 本地知识库：features / guides / FAQs / LAW_QA（含法律依据 basis + 合规建议 suggestions）
  └─ 云数据库 regulations 集合：
       · 国家名检测 → country code（VN/TH/SG/MY/ID）
       · 主题词检测 → theme code（data/consumer/tax/ip/ecommerce...）
       · 组合条件查询 → 关键词二次打分 → Top-3
       · 3 秒超时保护：云库未返回则降级为仅本地知识
```

**超时降级**是 RAG 工程里非常实用的细节：云库检索失败不能阻塞回答，本地知识保底。

---

## 5. 知识图谱 + RAG 双路召回（GraphRAG）

这是溯源平台最核心、也最具参考价值的架构。当业务数据是**强关系型**（企业 → 批次 → 批次 → 批次 → 追溯码）时，纯文档检索无法回答「XX 企业的完整供应链链路」「同源链路有哪些检疫员」这类**关系推理问题**，必须引入知识图谱。

### 5.1 知识图谱的构建

```text
MySQL 业务数据库（meat_traceability_data.sql）
  │
  ▼  build_rich_graph.py
graph.json（250 节点 / 746 条边）
  │
  ├─ gen_graph_html.py  →  graph.html（ECharts 可视化）
  └─ rebuild_docs.py    →  15 份 .md 业务文档 → DocumentStore 倒排索引
```

图谱的 8 个业务层级：

```text
企业 → 养殖批次 → 屠宰批次 → 批发批次 → 零售/溯源码 → 品种 → 人员 → 地区
```

节点命名规范（前缀即类型）：

| 前缀 | 实体 | 示例 |
|---|---|---|
| `ent_N` | 企业 | `ent_1` = 广东生态养殖有限公司 |
| `farm_N` | 养殖批次 | `farm_1` = F2024060001 |
| `slaughter_N` | 屠宰批次 | `slaughter_1` |
| `whole_N` | 批发批次 | `whole_1` |
| `retail_N` | 零售批次 | `retail_1` |
| `trace_XXX` | 溯源码 | `trace_TRACE20240602001` |
| `variety_X` | 品种 | `variety_育肥猪` |
| `province_N` / `city_N` | 省份/城市 | `province_1` |
| `inspector_X` / `legal_X` | 检疫员/法人 | `inspector_李卫民` |

关系类型（边）：

| 关系 | 含义 |
|---|---|
| 属于 | 批次归属企业，城市归属省份 |
| 供货给 | 企业供应链上下游 |
| 位于 | 企业位于省/市 |
| 来源于 | 批次间流转 |
| 同省企业 / 同市企业 | 同区域企业 |
| 同养殖场批次 / 同屠宰场批次 | 同企业同阶段批次 |
| 同品种(x) | 跨阶段同品种批次 |
| 法定代表人 | 企业 → 法人 |
| 检疫 / 检验 | 批次 → 检疫员 |
| 同企业(x) | 同一企业的人员互连 |
| 同溯源链路 | 同一完整链路的检疫员 |

### 5.2 图存储与查询实现

图谱以 JSON 文件加载进内存，构建节点索引和邻接表：

```java
public void buildIndexes() {
    // 节点索引：id → GraphNode
    // 邻接表：source → [边]，同时加入反向边（按无向图处理）
}

// 按名称搜索（精确优先，模糊兜底）
List<GraphNode> searchByName(String name);

// 按关键词搜索（匹配名称和分类）
List<GraphNode> searchByKeyword(String keyword);

// BFS 最短路径（"查两节点间链路"）
List<String> shortestPath(String fromId, String toId);
```

BFS 最短路径的实现：

```java
Queue<String> queue = new LinkedList<>();
Map<String, String> parent = new HashMap<>();   // 记录前驱节点，用于回溯
queue.add(fromId);
visited.add(fromId);
while (!queue.isEmpty()) {
    String current = queue.poll();
    if (current.equals(toId)) {
        // 从目标节点沿 parent 回溯，倒序还原路径
        return path;
    }
    for (GraphLink link : getLinks(current)) {
        if (!visited.contains(link.target)) {
            visited.add(link.target);
            parent.put(link.target, current);
            queue.add(link.target);
        }
    }
}
```

### 5.3 双路召回流程（核心）

```java
public String retrieve(String question) {
    // ① KG 先检索：锁定涉及哪些实体、它们如何关联 → 定义逻辑边界
    String kgContext = buildGraphContext(question, kgEntityNames);

    // ② 文档检索：在 KG 锁定的实体范围内，检索业务文档段落（补充语义细节）
    if (!kgEntityNames.isEmpty()) {
        docContext = documentStore.searchByEntities(kgEntityNames);
    }

    // ③ KG 未命中 → 退化为纯文档关键词检索
    if (kgContext.isEmpty()) {
        docContext = documentStore.searchByKeywords(question);
    }

    // ④ 全部未命中 → 数据库兜底（统计、列表、链路查询）
    if (kgContext.isEmpty() && docContext.isEmpty()) {
        return retrieveFromDatabase(question);
    }

    // ⑤ 分区合并注入 Prompt
    return buildGraphRagPrompt(kgContext, docContext, kgEntityNames);
}
```

Prompt 分区结构：

```text
> 以下信息由 GraphRAG 双路召回提供，基于知识图谱锁定边界、业务文档补充细节
> 涉及实体：广东生态养殖有限公司、F2024060001、育肥猪

# 区域一：知识图谱事实（关系骨架）
### 相关实体与关系
- 广东生态养殖有限公司 → 属于 → F2024060001（养殖批次）
- 企业位于 广东省/广州市

# 区域二：业务文档细节（语义上下文）
## 批次流转规则
...
```

### 5.4 图谱实体匹配的工程细节

中文公司名匹配是最难的环节，项目用三层策略：

```java
// 1. 正则提取公司名（"广东生态养殖有限公司" 等）
Pattern COMPANY_NAME_PATTERN = Pattern.compile(
  "[\\u4e00-\\u9fa5]{2,20}(?:有限公司|养殖场|屠宰场|批发市场|超市|连锁|农场|牧场)");

// 2. 无公司名时，提取中文长词做模糊搜索（跳过停用词）
String[] stops = {"请问","帮我","查询","这个","那个","所有的","完整的","系统内","数据库",
                  "有什么","是什么","怎么","如何","怎样","能不能","可以","是否","有没有",
                  "溯源","链路","系统","平台","问题"};

// 3. 省份名枚举匹配（广东/湖南/四川...）
```

### 5.5 热更新：数据变了不用重启

```text
1. 运行 rebuild-graph.bat（重建图谱 + 文档）
2. 调用 POST /api/assistant/reload
3. 下次查询自动从磁盘重新加载图谱 + 文档
```

对应后端：

```java
@PostMapping("/reload")
public ResponseEntity<Map<String, Object>> reload() {
    knowledgeBase.reload();
    // Graph + Docs reset. Next query will reload from disk.
}
```

**GraphRAG 的核心价值**：知识图谱提供「关系骨架」和「逻辑边界」，文档检索提供「语义细节」。单一文档 RAG 答不了关系问题，单一图谱又缺细节——双路召回是当前性价比最高的折中方案。

---

## 6. 提示词工程：让模型按规矩办事

### 6.1 系统提示词的组成要素

综合四个项目，一个合格的系统提示词包含：

| 要素 | 说明 | 示例 |
|---|---|---|
| 身份设定 | 我是谁 | 「你是天枢精灵，是天枢便签的专属智能助手」 |
| 职责边界 | 我能做什么 | 「负责解答使用问题、功能介绍、使用指南」 |
| 知识范围 | 依据什么回答 | 「熟悉东盟各国电商法规、数据保护法」 |
| 回答规则 | 怎么回答 | 「简洁专业、使用中文、编号列表、适当 emoji」 |
| 防幻觉指令 | 不知道怎么办 | 「资料不足时如实说明，不要编造法条」 |
| 格式约束 | 输出什么格式 | 「回复控制在 500 字以内」 |

### 6.2 身份锚定：防「串台」

天枢便签的系统提示词有个值得学习的细节——明确告诉模型**你不是豆包**：

```text
1. 你是天枢便签专属的智能助手，名字是天枢精灵
2. 你不是豆包或其他 AI，你是专门为天枢便签开发的助手
3. 你的主要职责是帮助用户了解和使用天枢便签的各项功能
4. 当用户询问你的名字时，你要明确回答你是天枢精灵
```

这解决了接入第三方模型时的品牌一致性问题。

### 6.3 动态系统提示词

智贸法桥的 `chatWithRegulation` 展示了「按场景动态构造提示词」的写法——把一条具体的法规记录（含原文）作为上下文塞进 system：

```javascript
function buildRegulationSystemPrompt(regulation) {
  var content = regulation.content || '';
  if (content.length > 4000) {
    content = content.substring(0, 4000) + '…（原文过长已截断）';
  }
  return '你是智贸法桥的「法规解读助手」，正在为用户解读一条具体的东盟国家法规。你必须严格基于下面给出的法规内容回答，不得编造法条或条文编号；法规原文没有覆盖的内容，如实说明并给出一般性合规提示。\n\n'
    + '【本条法规信息】\n'
    + '法规名称：' + regulation.lawName + '\n'
    + '国家：' + regulation.countryName + '\n'
    + '主题：' + regulation.themeName + '\n'
    + '风险等级：' + regulation.risk + '\n'
    + '【法规原文】\n' + content + '\n\n'
    + '【回答要求】\n'
    + '1. 用通俗易懂的中文解读…\n'
    + '2. 涉及具体义务、处罚、时限、资质要求时，引用原文对应内容\n'
    + '3. 条理清晰，可分段列出\n'
    + '4. 用户问的内容法规原文未覆盖时，如实说明，并补充合规提示（注明"仅供参考，不构成法律意见"）\n'
    + '5. 回答控制在 500 字以内';
}
```

要点：**上下文长度限制（4000 字符截断）+ 引用原文要求 + 免责声明**。

### 6.4 用表格固定输出格式

溯源平台让模型用 Markdown 表格输出溯源结果：

```text
| 环节 | 企业名称 | 批次编号 | 关键信息 | 日期 |
|------|----------|----------|----------|------|
| 🐄 养殖 | XX养殖场 | F2024060001 | 动物检疫：xxx | 2024-06-01 |
| 🏭 屠宰 | XX屠宰场 | S2024060601 | 肉品检疫：xxx | 2024-06-06 |
```

「给模型看输出样例」比「告诉模型要格式清晰」可靠得多——这是提示词工程里最实用的一条经验。

---

## 7. 对话记忆：上下文窗口管理

### 7.1 SQLite 环形记忆（溯源平台）

```java
public class ChatHistoryStore {
    private static final int MAX_ROUNDS = 10;   // 最近 10 轮

    // 保存：INSERT 后清理超过 20 条（10轮×2）的旧消息
    private void trim() {
        String sql = "DELETE FROM chat_message WHERE id NOT IN " +
            "(SELECT id FROM chat_message ORDER BY id DESC LIMIT " + (MAX_ROUNDS * 2) + ")";
    }

    // 读取：倒序取出再翻转，保证时间正序
    // 使用：historyStore.getRecentRoundsAsInput()  → 直接作为 messages 数组
}
```

请求体组装顺序：

```text
messages = [system(RAG 上下文 + 角色设定)] + [历史对话(前9轮)] + [当前用户消息]
```

设计要点：

1. **FIFO 截断**：固定 10 轮，新消息挤掉最旧的，防止 context 无限膨胀；
2. **排除当前消息**：当前用户消息已单独保存，组装历史时去掉最后一条避免重复；
3. **清空入口**：前端垃圾桶图标 → DELETE /api/assistant/history。

### 7.2 记忆管理的常见方案对比

| 方案 | 实现 | 优点 | 缺点 |
|---|---|---|---|
| 固定轮数截断 | SQLite/Redis 存最近 N 轮 | 简单、可控 | 过早遗忘 |
| 摘要压缩 | 定期让 LLM 总结旧对话 | 长会话保留关键信息 | 多一次调用、有损 |
| 滑动窗口 + 摘要 | 近 N 轮原文 + 更早的摘要 | 平衡 | 实现复杂 |
| 向量记忆 | 记忆向量化存向量库，按相关度召回 | 精准 | 需要 embedding 服务 |

---

## 8. 流式输出：SSE 打字机效果

### 8.1 为什么需要流式

大模型生成完整回答可能耗时数秒到数十秒。非流式会让用户盯着「转圈」，体验极差。流式输出（token 边生成边推送）配合前端打字机效果，是 AI 产品的体验标配。

### 8.2 后端实现（Spring Boot SseEmitter）

```java
@PostMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public SseEmitter chat(@RequestBody Map<String, String> body) {
    SseEmitter emitter = new SseEmitter(120_000L);   // 120s 超时

    executor.execute(() -> {
        // 1. 路由判断
        Intent intent = IntentClassifier.classify(message);
        // 2. 快速回复（本地）或溯源码查询：直接返回
        // 3. RAG 检索
        String ragContext = knowledgeBase.retrieve(message);
        // 4. 调大模型流式接口，边收边推
        StringBuilder fullReply = streamToVolcengine(emitter, systemPrompt, message);
        // 5. 保存完整回复到历史
        historyStore.save("assistant", fullReply.toString());
    });
    return emitter;
}
```

### 8.3 SSE 数据解析

从 `chat/completions` 流中逐行读取 `data:` 前缀，解析 delta：

```java
while ((line = reader.readLine()) != null) {
    if (!line.startsWith("data:")) continue;
    String data = line.substring(5).trim();
    if (data.isEmpty() || "[DONE]".equals(data)) continue;

    String delta = extractContent(data);   // 解析 {"choices":[{"delta":{"content":"文本"}}]}
    emitter.send(SseEmitter.event().name("message").data(mapOf("delta", delta, "type", "text")));
}
emitter.send(SseEmitter.event().name("message").data(mapOf("type", "done")));
```

### 8.4 本地回复也流式

溯源平台有个巧妙的处理：**本地快速回复也做成流式**（按 3 字符分块 + 12ms 间隔），保证前端体验一致：

```java
for (int i = 0; i < replyText.length(); i += 3) {
    String chunk = replyText.substring(i, Math.min(i + 3, replyText.length()));
    emitter.send(... mapOf("delta", chunk, "type", "text"));
    Thread.sleep(12);
}
```

事件协议设计：`delta`（增量文本）+ `type`（text/error/done），前端按 type 渲染。

---

## 9. 多模态：两阶段视觉处理

### 9.1 两阶段架构

智游修记和智贸法桥都采用了「视觉模型先分析 → 语言模型再综合」的两阶段方案：

```text
用户上传图片 + 问题
  │
  ├─ 阶段一：视觉模型分析图片
  │     doubao-seed-1-6-vision → 图片详细描述
  │     （失败则降级到备用视觉模型）
  │
  └─ 阶段二：语言模型综合
        [图片描述 + 用户问题] → 最终回答
        （失败则降级：仅返回图片描述）
```

为什么不用多模态模型一次搞定？

1. **token 控制**：图片转 base64 后体积巨大，两阶段只在阶段一传图片；
2. **降级灵活**：视觉模型挂了，语言模型仍能基于描述回答；
3. **职责分离**：视觉模型描述事实，语言模型负责专业判断。

### 9.2 视觉 API 调用（OpenAI 兼容格式）

```javascript
messages: [{
  role: 'user',
  content: [
    { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,...' } },
    { type: 'text', text: '请详细描述这张图片的内容，包括...' }
  ]
}]
```

### 9.3 文档分析管道（火山文档分析系统）

天枢便签附带了一个完整的文档分析后端（FastAPI）：

```text
上传文件（PDF/TXT/DOCX/HTML/PNG/JPG）
  → 按格式提取文字：
      PDF → PyPDF2 逐页提取
      DOCX → python-docx 逐段提取
      PNG/JPG → pytesseract OCR（chi_sim+eng）
      HTML → BeautifulSoup 去标签
  → 按功能选择模型：
      思维导图 → doubao-pro-4k（短文本）
      周报/月报 → doubao-pro-32k（长文本）
      图片识别 → doubao-vision-pro（视觉）
  → 生成思维导图 JSON / Markdown 周报
```

**按功能分级选模型**（4k / 32k / vision）是控制成本的关键：不是所有任务都用最大模型。

---

## 10. 防幻觉：RAG 应用的生命线

综合四个项目的实践，防幻觉有「四板斧」：

### 10.1 资料优先 + 引用要求

```text
「请优先依据下面检索到的资料回答…必须引用具体法律依据（条文/来源），不得编造法条」
```

### 10.2 知识不足时明确说不知道

```text
「如果知识库中没有相关信息，请如实告知用户，不要编造」
「法规原文没有覆盖的内容，如实说明并给出一般性合规提示」
```

### 10.3 系统提示词控制输出

```text
「回答简洁专业，使用中文，涉及具体数据时引用字段名和数值」
```

### 10.4 结构化数据直查

能查库的绝不靠模型记忆（溯源码查询直接返回数据库结果）。**结构化兜底是 RAG 最强的防幻觉手段**——模型只负责「组织语言」，不负责「记住事实」。

---

## 11. 进阶知识：向量检索、Agent 与工程化

四个项目代表的是「规则路由 + 轻量 RAG」的务实路线。要构建更复杂的大模型应用，还需要掌握以下进阶能力。

### 11.1 Embedding 与向量检索

关键词检索的局限：无法处理**语义相近但字面不同**的问题（「猪肉哪来的」vs「育肥猪的溯源路径」）。

向量检索流程：

```text
离线：文档切块 → Embedding 模型编码 → 向量库（Milvus/FAISS/pgvector/Qdrant）
在线：用户问题 → 同一 Embedding 模型编码 → 向量相似度检索（余弦/内积）→ Top-K
```

工程要点：

- 切块策略：按语义段落切（标题/章节），块大小 200–800 token，重叠 10–20%；
- 混合检索：向量检索 + 关键词检索 + 重排序（rerank），效果优于单一方式；
- 向量库选型：数据量 < 100 万且场景简单用 pgvector；海量/高并发用 Milvus；
- 元数据过滤：先按国家/主题/时间过滤，再向量检索，精度和性能双提升（智贸法桥的 country + theme 过滤已经是这个思路）。

### 11.2 RAG 评估体系

没有评估的 RAG 是玄学。需要建立三套指标：

| 维度 | 指标 | 说明 |
|---|---|---|
| 检索质量 | Recall@K / MRR / NDCG | 相关文档有没有被召回 |
| 生成质量 | 忠实度（faithfulness）/ 答案相关性 | 回答有没有忠于资料 |
| 端到端 | 人工评分 / LLM-as-Judge | 用户视角的综合体验 |

评测集建议：每个意图类型至少 20–50 条真实问题，标注「期望召回文档」和「期望答案要点」。

### 11.3 Agent：从问答到执行

RAG 解决「回答问题」，Agent 解决「完成任务」。演进路线：

```text
规则路由 → RAG 问答 → 工具调用（function calling）→ 多步 Agent → 多 Agent 协作
```

核心组件：

1. **工具注册**：`{"name": "trace_by_code", "description": "按溯源码查询完整链路", "parameters": {...}}`
2. **循环决策**：模型判断需要哪个工具 → 调用 → 结果回填 → 再判断
3. **预算控制**：最大步数、最大 token、超时熔断
4. **可观测**：每一步的思考、工具调用、结果都要留痕

### 11.4 成本优化清单

综合四个项目的实践：

| 手段 | 收益 |
|---|---|
| 本地意图命中（60–70% 走 0 token） | 成本直接降一大半 |
| 结构化数据直查代替模型回答 | 零成本 + 零幻觉 |
| 按任务分级选模型（4k/32k/vision） | 避免大材小用 |
| 两阶段视觉（先视觉后语言） | 减少图片 token 重复传输 |
| 对话历史 FIFO 截断 | 控制输入 token |
| RAG 上下文只取 Top-5 + 截断 | 控制 prompt 长度 |
| 本地快答也走流式 | 感知体验统一 |

### 11.5 安全与合规

1. **API Key 管理**：密钥必须放服务端，前端只暴露网关地址（本项目源码里密钥硬编码属于反面教材）；
2. **Prompt 注入防护**：用户输入里可能包含「忽略以上指令」等注入，需要输入过滤 + 输出校验；
3. **内容合规**：法律、医疗等领域必须加免责声明（智贸法桥「仅供参考，不构成法律意见」）；
4. **敏感数据**：RAG 语料要脱敏，对话日志要脱敏存储；
5. **限流与熔断**：按用户限流，模型超时降级到本地回复；
6. **可观测性**：记录每次请求的 intent、检索命中、token 消耗、延迟，用于持续调优。

### 11.6 架构演进路线图

```text
阶段一：纯规则（0 token）
  意图匹配 + 固定话术 + 数据库直查

阶段二：轻量 RAG（本项目的水平）
  + 关键词/倒排索引检索 + 上下文注入 + 流式输出

阶段三：GraphRAG / 混合检索
  + 知识图谱双路召回 + 向量检索 + rerank

阶段四：Agent 化
  + function calling + 多步规划 + 工具生态

阶段五：多 Agent + 记忆系统
  + 子 Agent 分工 + 长期记忆 + 自动评估闭环
```

四个项目的实践已经完成了阶段一到二，溯源平台触及阶段三。**每一步升级的前提，都是上一阶段的数据和反馈积累。**

---

## 12. 结语

从这四个项目可以提炼出大模型应用开发的完整心法：

1. **架构上分层**：UI → 路由 → 检索 → 生成 → 存储，每层职责单一；
2. **路由上分级**：规则保底、意图分流、模型兜底，能省则省；
3. **检索上多路**：知识图谱管关系、文档管细节、数据库管事实、向量管语义；
4. **提示词上设界**：身份、范围、规则、防幻觉四件套缺一不可；
5. **体验上流式**：SSE + 打字机是 AI 产品的默认配置；
6. **工程上可观测**：意图命中率、检索命中率、token 成本、延迟，全部要能度量。

大模型只是「最聪明的实习生」，架构师的工作是**给这个实习生配好资料室（检索）、规章制度（提示词）、记事本（记忆）和秘书（路由）**。

---

### 参考链接

- 火山方舟（Volcano ARK）API 文档：`ark.cn-beijing.volces.com/api/v3`
- OpenAI Chat Completions API 格式规范（兼容层标准）
- Spring Framework SSE（SseEmitter）文档
- Milvus / FAISS / pgvector 向量数据库官方文档
- LangChain / LlamaIndex RAG 与 Agent 框架文档
