# 从零写一个会「爆」的 Skill：AI 技能包创作指南

> 一句话结论：Skill 不是普通提示词模板，而是一个**带入口描述、可被模型自动发现并加载的能力包**。市面爆款 skill 的共同点很一致——小而准、触发描述明确、示例可落地、目录结构规范。

本文面向两类读者：

- 想在 Claude Code / Codex / Gemini CLI 里沉淀自己工作流的开发者；
- 想开源一个 skill 仓库、被大量人安装使用的作者。

---

## 1. Skill 是什么，为什么突然火了

**Skill（技能包）** 是一个包含 `SKILL.md` 的文件夹。`SKILL.md` 用结构化文本告诉模型「你什么时候该用我、怎么用我」，模型按任务自动判断是否触发。

和传统提示词的本质区别：

| | 普通提示词 | Skill |
|---|---|---|
| 使用方式 | 每次手动复制粘贴 | 安装一次，模型按任务自动触发 |
| 可复用性 | 低，靠人记住 | 高，文件夹即能力包 |
| 可分享 | 零散文本 | 仓库、版本化、可收藏 |
| 发现机制 | 无 | name + description 自动注入上下文 |

它火的原因很直接：AI 助手从「一次对话」进化为「可复用能力平台」，而 Skill 就是能力的标准包装格式。生态已经验证了这一点：

- ComposioHQ/awesome-claude-skills 仓库 6.4 万+ Star，收录十几个领域的精选 skills；
- VoltAgent/awesome-agent-skills、casualuser/awesome-agent-skills 等仓库收录 1000+ 个 skills，且明确跨 Claude Code / Codex / Gemini CLI / Cursor 兼容；
- Anthropic 官方也发布了 skills 示例（e2e-testing、systematic-debugging、mcp-builder），说明这不是社区自嗨，而是平台官方方向。

## 2. 核心机制：SKILL.md 的结构

一个最小 skill 只需要一个文件，但完整结构通常是：

```text
my-skill/
├── SKILL.md          # 唯一必须文件，文件名大小写敏感
├── references/       # 长文档、模板、知识库放这里
└── scripts/          # 可执行脚本放这里
```

`SKILL.md` 的基础骨架：

```markdown
---
name: my-skill
description: 何时使用……何时不使用……
---

# 使用说明

按以下步骤执行：
1. ...
2. ...
```

frontmatter（`---` 之间的 YAML）里只有两个字段是必须的：

| 字段 | 作用 | 写作要点 |
|---|---|---|
| `name` | 技能唯一标识 | 简短、无空格、小写连字符 |
| `description` | 触发开关 | 第三人称、写明触发条件与排除条件 |

### 2.1 渐进式披露（Progressive Disclosure）

这是 Skill 机制里最容易被忽略、却最关键的设计：

- 模型平时**只注入 name + description**（几十个 token）；
- 只有当任务与 description 匹配时，才加载完整的 `SKILL.md` 正文，必要时再读 `references/` 下的引用文件。

推论：

1. **description 决定触发率**——写不好，正文再完美也不会被调用；
2. **正文决定完成质量**——但正文长不等于好，冗长内容要外置，避免浪费 token。

## 3. 怎么设计一个「爆款」skill

翻遍 GitHub 上高 Star 的 skill，共同点可以归纳成五条。

### 3.1 描述要能精准触发

description 是模型判断「用不用」的唯一依据，必须：

- 用**第三人称**（模型读到的是对自身的描述）；
- 写明**何时用**，也写明**何时不用**；
- 与其他 skill 保持高区分度。

对比：

```text
差：Use this skill for coding tasks.

好：Use when debugging flaky end-to-end tests in Playwright:
    analyzing failures, reproducing flakiness, and producing
    a regression report. Do not use for writing new tests.
```

### 3.2 单一职责，小而精

爆款几乎都是「一件事做到极致」：

- claude-mem：只做对话/项目持久记忆；
- ui-ux-pro-max-skill：只做 UI/UX 设计评审；
- everything-claude-code：覆盖日常开发全流程，但内部按步骤模块化。

什么都做的 skill 描述会互相打架，触发判断变难，模型反而不知道该不该用。

### 3.3 示例 > 长篇大论

模型靠示例理解流程，而不是靠抽象原则。每个关键步骤给「输入 → 输出」示例，比二十行形容词有效得多。

### 3.4 长内容外置

`SKILL.md` 控制在几十行内；完整规范、模板、知识库放 `references/`，脚本放 `scripts/`。既符合渐进式披露的加载方式，也让使用者一眼看懂这个 skill 是干嘛的。

### 3.5 面向跨平台编写

同一份 `SKILL.md` 格式在 Claude Code、Codex、Gemini CLI 都能被识别。写作时避免绑定某一家的私有语法（比如某个工具专有的 XML 标签），受众面立刻翻倍——这也是现在 GitHub 上 skill 仓库的明显趋势。

## 4. 完整示例：一个「代码审查」skill

下面是一个可直接使用的微型 skill，完整展示了 frontmatter、流程、输出格式与引用文件的组织方式：

```text
code-review/
├── SKILL.md
└── references/
    └── checklist.md
```

`SKILL.md`：

```markdown
---
name: code-review
description: Review a pull request or code diff for correctness,
  security, and maintainability. Use when the user asks to review
  code, a PR, or a diff. Do not use for documentation-only changes.
---

# Code Review

## 流程
1. 阅读完整 diff 与相关上下文文件。
2. 按严重程度分类问题：P0 正确性/安全 → P1 可维护性 → P2 风格。
3. 每个问题给出：位置 + 原因 + 建议改法。
4. 总结：变更是否达成意图、是否存在阻塞项、是否可以合并。

## 输出格式
| 级别 | 位置 | 问题 | 建议 |
|---|---|---|---|
| P0 | src/auth.ts:42 | 密码明文比较 | 改用 timing-safe 比较 |

## 参考
- 完整检查清单见 references/checklist.md
```

`references/checklist.md`（正文外置的长内容）：

```markdown
# 审查清单

- 输入是否做了边界校验？
- 错误路径是否泄露内部信息？
- 是否有未处理的异步失败？
- 变更是否覆盖了对应测试？
- 是否引入不必要的依赖？
```

注意：示例里用「表格」给模型定死输出格式，比用自然语言描述「要格式清晰」可靠得多。

## 5. 安装与测试

不同工具的 skill 根目录（同一份文件可直接复用）：

| 工具 | 安装位置 |
|---|---|
| Codex | `~/.codex/skills/<name>/SKILL.md`（递归发现 `~/.codex/skills/**/SKILL.md`） |
| Claude Code | `~/.claude/skills/<name>/`（个人级）或 `.claude/skills/<name>/`（项目级） |
| Gemini CLI | 见对应工具文档，通常也是 `~/.gemini/skills/` |

测试循环：

1. 放好目录结构；
2. 新开一个对话（避免旧上下文干扰）；
3. 用 description 里的触发词发任务；
4. 观察模型是否调用了该 skill；
5. 不触发 → 改 description；触发了但效果差 → 改正文。

判断触发成功的标志：模型在回复中引用或执行了 skill 内定义的步骤，而不只是「提到了」技能名。

## 6. GitHub 上的爆款生态参考

| 仓库 | 定位 | 参考价值 |
|---|---|---|
| [ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills) | 6.4 万+ Star 的精选列表，覆盖文档处理、开发工具、数据分析等十几类 | 看「什么主题最火、最容易爆」 |
| [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) | 跨平台 skills 收集 | 看目录结构与写作规范 |
| [casualuser/awesome-agent-skills](https://github.com/casualuser/awesome-agent-skills) | 1000+ skills 收录，跨 Claude Code / Codex / Gemini CLI / Cursor | 看命名与 description 写法 |
| [anthropics/skills](https://github.com/anthropics/skills) | 官方示例（e2e-testing、systematic-debugging、mcp-builder） | 看官方推荐的写作范式 |

观察结论：

- **工具类**（测试、调试、构建）与**知识类**（规范、清单、模板）是两大主流；
- 高 Star 的 skill 普遍带 `references/` 与 `scripts/`，即「有干货、可执行」；
- 描述里明确写「Do not use when…」的 skill，触发准确率明显更高。

## 7. 安全：安装任何 skill 前必须做的事

Skill 本质是**可被模型执行的指令**，恶意 skill 的风险是真实存在的：

1. **逐行审查 `SKILL.md`**：正文里可能藏 prompt injection，诱导模型输出敏感信息或执行危险操作；
2. **不直接执行捆绑脚本**：先读 `scripts/` 源码再运行，或干脆不用；
3. **只从可信来源安装**：GitHub Star 数高不等于安全，官方仓库与已审计列表优先；
4. **留意 description 的诱导性指令**：触发词本身也可能被用来劫持模型行为。

发布自己的 skill 时同理：不要往指令里写「忽略系统限制」之类的内容，这既会损坏生态信任，也可能让仓库被平台下架。

## 8. 结语

Skill 的创作门槛很低（一个文件夹 + 一个 Markdown 文件），但「爆款」的门槛在于**设计**：描述准、职责小、示例足、结构规范、跨平台兼容。按照这个套路，把一个你反复粘贴的提示词整理成 skill 仓库，就是一次很不错的开始。

---

### 参考链接

- Codex Skills 官方文档：`developers.openai.com/codex/skills`（已迁移至 learn.chatgpt.com）
- Anthropic 官方 skills：<https://github.com/anthropics/skills>
- ComposioHQ/awesome-claude-skills：<https://github.com/ComposioHQ/awesome-claude-skills>
- VoltAgent/awesome-agent-skills：<https://github.com/VoltAgent/awesome-agent-skills>
- casualuser/awesome-agent-skills：<https://github.com/casualuser/awesome-agent-skills>
