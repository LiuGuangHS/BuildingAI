# 乐园小镇

`echoflow-ai-town` 是 EchoFlow 的小镇经营游戏插件。用户端直接进入可玩小镇，建造、装饰并经营专属小镇，围绕存档、行动、居民关系、事件、日结、今日计划和居民对话形成日常循环；Console 负责模型配置、存档诊断、日志和运营排查。

文档维护：跨插件通用规范见根 `AGENTS.md`；本 README 只记录本插件的业务事实、入口、特有边界、验证状态、风险和下一步。临时计划或 QA 结论收口后只合并仍有效内容，不长期维护第二套文档。

## 定位

| 维度 | 当前边界 |
|---|---|
| 产品形态 | 经营叙事游戏，不做营销落地页或“进入工作台”中转页。 |
| AI 价值 | 作为镇务参谋、叙事导演和居民表演层；资源、奖励、扣费和成长仍由确定性规则控制。 |
| 用户体验 | 第一屏展示小镇场景、资源、目标、建筑/居民热点和行动命令牌，保持可玩场景为视觉中心。 |
| 商业方向 | 优先售卖故事深度、记忆容量、角色章节、季节活动和外观表达；不卖数值碾压。 |
| 管理职责 | Console 只做 AI 配置、存档管理、日志统计、测试生成和异常诊断。 |

## 当前能力

| 能力 | 状态 | 说明 |
|---|---|---|
| 存档 | ready | 支持创建、读取、软删除；删除时同步软删除角色和事件。 |
| 存档入口 | ready | 旧存档列表使用回到小镇、回到存档和读取街区等游戏语境文案，不再把再进入游戏写成泛应用的“继续”。 |
| 存档移除 | ready | 存档删除弹窗使用移入旧档箱、留在小镇等小镇归档语境，同时说明存档、居民和事件会一同归档。 |
| 公开元信息 | ready | 插件 manifest、package 和安装记录使用乐园小镇与经营叙事游戏语境，避免应用列表、安装记录或市场入口先暴露泛 AI 应用命名。 |
| 路由加载与错误 | ready | 懒加载、错误页和未开放路径使用读取街区、重读小镇、返回小镇等玩法语境，避免首屏边缘露出泛应用的加载/刷新文案。 |
| 首屏降级 | ready | Web API 或旧存档列表暂不可用时仍展示可玩的场景预览、HUD、热点和命令预览；主 CTA 使用开张小镇，创建入口不可用时转为等待镇务服务，服务异常说明使用开张或回到旧档，状态条提供重试连接命令，首屏加载态使用小镇开张中、正在翻看旧存档和重连镇务中，避免白屏、故障页或诱导玩家点击必然失败的网络动作。 |
| 开局任务板 | ready | 首屏展示三步开张路线、奖励/记忆卖点和服务状态，让新玩家在第一分钟就知道先经营、再拜访、最后休息结算。 |
| 开局命令预览 | ready | 首屏降级时命令预览以行动牌展示经营、拜访、布置、探索和休息的用途、收益或解锁提示，并保留完整 aria-label，避免只剩静态词条。 |
| 行动循环 | ready | 经营、拜访、布置、探索、升级和休息都会经过服务端规则结算。 |
| 行动预算 | ready | 每日行动预算、同日重复动作拦截和 `rest` 重置已在服务端和前端联动。 |
| 场景热点 | ready | 建筑和居民热点展示推荐光环、可行动/不可行动原因、升级徽章、关系条和记忆约定，并用完整 aria-label 保留移动端被压缩的行动说明，不再只是地图文字标签。 |
| 首屏命令牌 | ready | 底部行动栏以游戏命令牌展示推荐、任务关联、收益预览、预算提示和 blocked 态；空预览使用可以出发，未知行动使用照看小镇/照看目标，推荐缺失时引导打开委托册，并把推荐、任务关联、预览和受限原因合并进按钮可访问名称，不再是普通按钮组或系统态按钮。 |
| 活动线索 | ready | 首屏目标板在无活动时展示探索街区和追踪线索入口，有活动时展示活动状态、剩余天数和奖励摘要，并用完整 aria-label 保留活动目标。 |
| 任务与目标行动入口 | ready | 日常任务、主线、周目标和活动会由规则推导下一步行动；任务抽屉直接提供经营餐馆、拜访居民、探索街区、升级建筑或休息结算等玩家动作 CTA，并复用行动预算、资源和建筑校验，不再使用“执行任务”“推进主线”“推进周目标”“筹备活动”这类后台式或目标式泛称。 |
| 目标空态 | ready | 主线和周目标无记录时展示路线卡、下一步经营/拜访/探索或休息结算入口，并复用统一行动校验，不让任务抽屉退回“正在整理中”“休息后刷新”这类被动占位。 |
| 今日计划推荐 | ready | 镇务参谋卡会把推荐映射成经营餐馆、拜访居民、探索街区、升级建筑或休息结算等具体玩家动作；今日计划推荐 CTA 显示规则映射后的具体玩家动作，不写成“执行推荐行动”。 |
| 参谋 HUD | ready | 镇务参谋入口在打开今日计划前先展示下一步玩家动作、收益预览和待回应约定数，等待态使用镇务排班中而不是思考中，让 AI 参谋价值直接出现在主场景。 |
| 成就空态 | ready | 成就徽章无记录时展示第一枚徽章卡、获得路径和规则推导的徽章行动入口，复用行动预算、资源和建筑校验，不让玩家只看到“这里会点亮成就”。 |
| 成就徽章墙 | ready | 已获得成就展示为徽章墙，每枚徽章保留成就册写入感，并提供下一枚徽章行动入口，让成就区继续驱动经营、拜访和主线推进。 |
| 移动端嵌入布局 | ready | 小屏下目标板、命令牌和场景提示进入流式布局，舞台允许纵向滚动并隐藏横向溢出，避免主系统 iframe 内裁切可操作内容。 |
| 视觉外壳 | ready | 外层舞台色盘使用晨光、草地和木质色，让地图与经营场景成为首屏第一视觉信号；不使用泛 AI 紫色发光外壳，也不通过拉伸字距制造科技感。 |
| 抽屉可控性 | ready | 游戏抽屉复用系统 Sheet 提供 dialog 语义、焦点管理、背景滚动锁定、Escape 关闭和关闭后焦点恢复；插件只保留业务标题、内容和关闭文案。 |
| 资源审计 | ready | 行动结果和日结展示金币、体力、声望、关系和等级 delta，并记录行动、选择、建筑、居民目标、预算、规则来源和模型/fallback 状态。 |
| 行动等待反馈 | ready | 行动或居民交流提交后在主场景边缘展示具体小镇命令状态，例如经营餐馆中、拜访居民中、镇务排班中或和居民交流中，避免玩家从点击到结算之间只看到泛加载。 |
| 错误反馈 | ready | 用户端行动错误使用小镇语境和可感知 alert 语义，默认错误提示为“小镇行动未完成”，不回退到普通应用式“操作失败”。 |
| 行动反馈 | ready | 行动完成后会弹出带 status 语义的奖励结算浮层，展示事件标题、玩家可读总结和资源变化，避免只飘普通数字条。 |
| 事件分支 | ready | 事件选择以分支行动牌展示，包含玩法标签、收益/拦截 chip、不可行动状态和可访问名称，不退回普通按钮组。 |
| 小镇日志 | ready | 日志抽屉以故事册时间线展示事件，按日期分组展示事件类型、行动写入状态、资源结果和分支选择，不退回普通卡片列表。 |
| 日结空态 | ready | 每日结算抽屉无历史结算时展示夜间账本和休息结算入口，引导玩家用休息动作写入收入、维护、声望和第二天目标，不只显示“这里会展示结算”。 |
| 动效可访问性 | ready | 奖励结算、等待信号、推荐光环、任务脉冲、抽屉位移和参谋排班态会响应系统减少动态效果设置，保留信息层级但停止循环动效或大幅位移。 |
| 居民对话 | ready | 支持主站 LLM 调用、本地 fallback、日志记录和关系推进。 |
| 居民对话舞台 | ready | 对话面板提供记忆/偏好/约定驱动的快捷话题、角色回复气泡、居民化输入占位、带居民名的可见聊天按钮和明确的聊天按钮可访问名称，避免退回普通输入表单。 |
| 居民头像兜底 | ready | 居民图片加载失败时，居民列表、居民详情和地图热点仍使用小镇居民头像样式；镇务参谋入口、额度提示和今日计划参谋头像也使用业务化占位，不回退到普通应用头像、裸首字母或裸文字占位。 |
| 对话状态 | ready | 切换居民会清空旧输入和旧回复，聊天成功后会同步最新居民记忆、关系和话题，避免气泡串到另一位居民身上。 |
| 居民记忆 | ready | 保存摘要、心情、偏好、约定、关键时刻和有限最近消息；prompt 只取白名单记忆片段。 |
| 记忆闭环 | ready | 待回应约定会影响推荐目标、行动预览、地图热点、镇务参谋和 Console 诊断。 |
| 额度提示 | ready | 今日计划和居民回复共用额度确认，文案按触发场景区分且不暴露管理员配置或模型生成；居民聊天确认会带当前居民名，说明文案使用安排计划前、和某位居民聊前会提示镇务额度，确认按钮使用安排计划、和某位居民聊、先留在小镇等玩法动作，避免从居民聊天跳出错位提示。 |
| 回合状态条 | ready | 首屏使用低遮挡状态条集中展示 Day、今日行动、推荐动作和下一目标；无推荐动作时引导玩家打开委托册，桌面只占舞台中间可用带宽，中等宽度提前转为流式 HUD，默认不吃点击事件，只保留任务按钮可交互，避免再堆一个大面板遮住场景。 |
| 连续开张 | ready | `worldState.retention` 记录有效日程、连续天数和下次回访钩子；任务抽屉提供匹配钩子的行动入口，回访奖励 CTA 显示匹配钩子的具体玩家动作，不写成“领取回访奖励”，奖励只在匹配下次钩子行动时由服务端结算，并写入玩家可读审计。 |
| Catalog | ready | 建筑、区域、初始居民、基础行动、事件选项、日常任务、周目标、主线章节、成就和节日候选已迁入 catalog。 |
| 内容包 | ready | `launch-core@0.0.1` / `season-0` manifest 已记录内容范围、seed 策略和幂等键；存档 `worldState.contentPack` 会保存当前内容包快照。 |
| 内容包运营页 | ready | Console 提供只读内容包面板，展示 manifest、存档覆盖、章节分布、活动状态和运营告警；暂不提供后台改内容开关。 |
| 正式计费 | ready | 已接入 `ExtensionBillingModule` / `ExtensionBillingService`；今日计划、居民聊天和探索导演价格由 Console 配置，默认价格为 0 时不扣费，真实模型成功且未 fallback 时才以事件 ID 作为 `associationNo` 幂等扣费，失败按账务事实退款。 |
| 天气 Catalog | ready | 天气效果乘数集中在 `catalog/town-weather.catalog.ts`，经营金币、拜访声望、探索体力消耗等数值配置与业务逻辑分离。 |
| 统计聚合优化 | ready | 统计查询使用 `GROUP BY` 单 SQL 聚合替代多次 COUNT 查询，消除 N+1 查询问题。 |
| 事件分页 | ready | getEvents 支持 `take` 参数分页，默认 50 条限制，防止全表扫描。 |

## 入口与页面

主系统用户入口是 `/apps/echoflow-ai-town/*`；extension bundle / local dev base 是 `/extension/echoflow-ai-town/*`。小镇当前 Console 文档使用完整 dev/base 路径，等价的 `consoleRoutes` 相对路径为 `/console/...`。

| 入口语义 | 路径 | 文件 | 职责 |
|---|---|---|---|
| 主系统 Web | `/apps/echoflow-ai-town/*` | `packages/client/src/pages/apps/[identifier]` | 主系统 iframe 宿主入口，加载本插件用户端。 |
| Extension bundle/dev | `/extension/echoflow-ai-town/` | `src/web/pages/index.tsx` | 小镇主场景、存档、行动、聊天、事件、日结和目标。 |
| Console full dev/base | `/extension/echoflow-ai-town/console/` | `src/web/pages/console/saves/list.tsx` | 存档列表、详情、预算、记忆和异常诊断。 |
| Console full dev/base | `/extension/echoflow-ai-town/console/ai-config` | `src/web/pages/console/ai-config.tsx` | LLM 模型、温度、token、fallback、每日限制和测试生成。 |
| Console full dev/base | `/extension/echoflow-ai-town/console/content-pack` | `src/web/pages/console/content-pack.tsx` | 内容包、赛季、seed、章节、活动和存档覆盖诊断。 |

路由由 `src/web/routes.tsx` 注册。为避免用户端首页同步拉入 Console Layout 和动态图标包，小镇保留官方 iframe 导航同步、登录守卫和 Console Layout 语义，但将 Console 外壳改为 lazy import；后续如主系统 `defineRouteOption()` 支持 Console lazy 注册，可再收敛回公共路由工厂。

## API 与后端模块

| 模块 | 文件 | 说明 |
|---|---|---|
| Module | `src/api/modules/town/town.module.ts` | 导入 `AiPublicModule`、`ExtensionBillingModule`，注册小镇业务服务和规则服务。 |
| Web Controller | `controllers/web/town.web.controller.ts` | 用户端存档、行动、聊天、事件和状态接口。 |
| Console Controller | `controllers/console/town.controller.ts` | 管理端配置、存档、日志、统计和测试生成接口。 |
| TownService | `services/town.service.ts` | 存档事务、行动结算、聊天写回、软删除和恢复边界。 |
| TownAiService | `services/town-ai.service.ts` | 主站 LLM 调用、结构化建议、居民回复、fallback 和日志。 |
| Rule Services | `town-world-rules.service.ts`、`town-relationship-rules.service.ts`、`town-progress-rules.service.ts` | 天气、日结、关系、任务、成就、解锁和奖励计算。 |
| Catalog | `catalog/*.ts` | 默认建筑、区域、居民、基础行动、事件选项、任务、周目标、主线章节、成就、节日候选和内容包 manifest。 |

## 用户端边界

| 主题 | 说明 |
|---|---|
| 页面形态 | 用户端继续作为主系统 iframe 内的业务面板，不重复账号、头像、全局导航、余额入口或完整应用壳。 |
| 首屏 | 首屏优先展示小镇场景、资源、目标、建筑/居民热点和行动命令牌，保持可玩场景为视觉中心。 |
| 行动循环 | 经营、拜访、布置、探索、升级和休息都会经过服务端规则结算；每日行动预算和同日重复动作拦截继续存在。 |
| 命令牌与热点 | 底部行动栏和地图热点必须呈现推荐、任务关联、收益预览、预算提示、不可行动原因与完整可访问名称。 |
| 记忆与对话 | 居民对话支持记忆、偏好、约定和关键时刻，白名单摘要进入 prompt，并影响推荐、预览、热点和 Console 诊断。 |
| 反馈 | 行动、日结和对话反馈都要展示资源变化与业务解释，不回退到普通应用式错误或加载壳。 |
| Console | 管理 AI 配置、存档诊断、日志统计、内容包只读面板和异常排查，不混入用户生成流程。 |

后端写入阶段使用存档锁保护资源、关系、任务和事件一致性；模型调用不放在长事务内。

## 关键技术边界

| 能力 | 当前实现 |
|---|---|
| AI 角色 | 主站 LLM 只做镇务参谋、叙事导演和居民表演层；金币、体力、声望、关系、奖励和扣费仍由服务端规则控制。 |
| 规则与 catalog | 建筑、区域、居民、行动、事件、任务、周目标、主线、成就、天气和内容包均由 catalog/rule service 维护，service 负责事务、校验和编排。 |
| 记忆闭环 | 居民摘要、心情、偏好、约定、关键时刻和有限最近消息进入白名单 prompt，并影响推荐目标、行动预览、地图热点和 Console 诊断。 |
| 计费 | 今日计划、居民聊天和探索导演使用主系统计费；默认价格为 0 时不扣费，fallback 不扣费，真实模型成功才按事件 ID 幂等扣费。 |
| 内容包 | `launch-core@0.0.1` / `season-0` manifest 记录内容范围、seed 策略和幂等键；存档保存内容包快照。 |
| 用户端语境 | 用户端只写小镇玩法语境；模型、Provider、fallback 等运维术语只保留在 Console。 |
| Console | 管理 AI 配置、存档诊断、日志统计、内容包只读面板和异常排查，不混入用户生成流程。 |

## 数据与存储

| 数据 | 说明 |
|---|---|
| 实体 | 存档、角色、事件、AI 配置和 AI 调用日志均使用 `@ExtensionEntity()`。 |
| Migration | 首版 migration：`src/api/db/migrations/1781539200003-0.0.1-init-ai-town.ts`。 |
| Upgrade | `src/api/upgrade/0.0.1/index.ts` 幂等修复 AI 配置单例键，写入主系统 extension 安装记录，并记录当前内容包版本。 |
| 初始内容 | 初始世界、角色和事件由 `createSave()` 在事务内生成；内容来源由 `town-content-pack.catalog.ts` 声明，当前首版采用 `create-save` seed 策略。 |
| 内容包快照 | `worldState.contentPack` 保存 `packId`、`version`、`seasonId`、`seededAt` 和 `idempotencyKey`；旧存档读取时会 normalize 到当前首发包。 |
| 软删除 | 删除存档会软删除存档、角色和事件；列表和统计默认只看未删除数据。 |
| 静态资源 | 运行界面资源位于 `src/web/assets.ts` 和 `storage/static`，发布包只依赖白名单内静态文件；地图、厨房、居民和夜晚事件都有真实图片背景，不用占位图模拟场景。 |

## 玩法与 AI 规则

| 规则 | 要求 |
|---|---|
| 数值边界 | AI 不直接改金币、体力、声望、关系、扣费或退款。 |
| 结构化输出 | 今日计划和事件必须经过服务端校验、裁剪和 intent 白名单映射。 |
| fallback | 模型未配置、禁用或失败时使用世界观化本地结果；用户端不展示上游错误或 fallback 字样。 |
| 用户端 AI 文案 | 用户端把模型能力表述为镇务参谋、今日计划、居民回复、规则补位等玩法语境；用户端事件审计和账务 chip 只展示参谋参与、规则补位或镇务额度，不使用生成内容、模型输出、小镇 AI 或 fallback 这类工具式文案，模型、Provider、AI 等运维术语只保留在 Console。 |
| 日程 | 行动预算、重复动作拦截和休息重置以服务端为最终边界。 |
| 每日 AI 额度 | Console 的 `dailyLimitPerUser` 是写入 AI 调用日志的可审计业务日预算，不等同于普通请求限流；Web 行动和居民聊天已额外叠加主系统 `ExtensionRateLimitService`，不要用请求限流替换玩法额度语义。 |
| 地图热点 | 建筑和居民热点必须呈现可行动性、推荐/升级/关系/记忆状态，并在移动端压缩非关键说明时用可访问名称保留关键行动说明，不能只做透明点击层或静态标签。 |
| 视觉外壳 | 首屏地图和经营舞台必须是第一视觉信号；外层壳使用小镇题材色盘，不回退到泛 AI 紫色发光 chrome，标签、徽章和 HUD 默认不使用非零字距拉伸。 |
| 首屏行动 | 首屏行动栏必须像游戏命令牌，展示推荐、任务关联、收益预览、预算提示和不可行动原因；预览为空时使用可以出发，未知行动用照看小镇/照看目标兜底，不退回继续行动、可执行或查看任务；回合状态条集中展示 Day、今日行动、推荐动作和下一目标，并在中等宽度转为流式 HUD，避免用户在多个边角面板里找当前回合重点或挤压主舞台。活动、赛季或限时事件入口不能只写等待线索，无活动时也要给出探索街区、打开委托册或回到场景的玩家动作。 |
| 任务目标 | 日常任务、主线、周目标和活动不能只展示进度；前端必须用规则层推导下一步行动，并复用统一行动状态、资源、预算和建筑目标校验；主线、周目标、活动和今日计划推荐 CTA 也必须显示具体玩家动作，不能写成“执行任务”“推进主线”“推进周目标”“筹备活动”或“执行推荐行动”。 |
| 居民对话 | 居民对话面板必须暴露由记忆、偏好、约定或关键时刻推导出的可点选话题，并用角色回复气泡承载输出；不能只是 textarea + 提交按钮。 |
| 记忆 | LLM prompt 只携带摘要、心情、偏好、约定、关键时刻和最近少量消息。 |
| 审计 | 资源变化应展示玩家可读解释，Console 可看到预算、记忆和异常诊断。 |

## 开发与验证

```bash
pnpm --filter echoflow-ai-town check-types
pnpm --filter echoflow-ai-town build:api
pnpm --filter echoflow-ai-town build:web
pnpm --filter echoflow-ai-town test
pnpm --filter echoflow-ai-town build:publish
```

验证证据：

| 范围 | 证据状态 | 命令/场景 | 环境基线 | 结论 | 后续条件 |
|---|---|---|---|---|---|
| 类型检查 | historical | `pnpm --filter echoflow-ai-town check-types` | Node 24 / pnpm 10.20.0 历史记录；当前仓库基线为 Node 22.20 / pnpm 10.20.0 | 历史通过。 | 作为发布证据前需在当前 Node 22.20 / pnpm 10.20.0 重新验证。 |
| 单测 | current | `pnpm --filter echoflow-ai-town test` | README 当前记录 | 覆盖规则闭环、内容包边界、前端首屏约束、AI 计费边界、限流和 UI 组件复用。 | 规则、计费或 UI 边界变更后重新执行。 |
| Console 图标白名单 | current | 静态测试 | README 当前记录 | 覆盖 Console 静态映射和未登记图标 fallback，类型层不再引用 `lucide-react/dynamic`。 | 新增 Console 菜单图标时同步扩展白名单和测试。 |
| API 构建 | current | `pnpm --filter echoflow-ai-town build:api` | README 当前记录 | API 产物已包含 catalog、migration 和 `0.0.1` upgrade。 | API 构建配置、catalog、migration 或 upgrade 变更后重新执行。 |
| Web 构建 | current | `pnpm --filter echoflow-ai-town build:web` | README 当前记录 | Vite Web 构建通过，首屏不再预加载 Console 和大图标块。 | Web 入口、Vite 配置或 Console lazy 边界变更后重新执行。 |
| 发布构建 | current | `pnpm --filter echoflow-ai-town build:publish` | README 当前记录 | 已完成 `clean -> build:web -> build:api` 发布构建链路；Vite Web 构建和 tsup API 构建均通过。 | 发布交付前重新执行，并检查 release allowlist。 |
| 真实浏览器 smoke | blocked | Vite 用户端 `http://localhost:5176/extension/echoflow-ai-town` 与桌面/移动截图 | Codex Browser 连接对象断开；Playwright 缺少 Chromium；系统 Chrome/Edge 未找到 | 只能确认 Vite 用户端可启动，没有新的桌面/移动截图证据。 | 恢复 Playwright Chromium、系统浏览器或可连接浏览器后再按主系统插件容器复验。 |

## 已知风险

| 风险 | 影响 | 下一步 |
|---|---|---|
| AI 上下文与写回分阶段 | 并发行动时 AI 文案可能基于稍早状态，资源结算仍以锁内最新状态为准。 | 如需强一致叙事，引入 action revision 或处理中状态。 |
| 内容包仍是代码 manifest | 首发包已有版本、赛季、seed 策略和 Console 只读运营页，但还没有数据库化内容配置或发布审核流。 | 后续把可运营内容扩展为 catalog + seed/config 管理页，并保持 service 只做事务、校验和编排。 |
| 计费真实联调未完成 | 静态边界和类型检查已覆盖事件 ID associationNo、默认 0 免费、fallback 不扣费和失败退款路径，但还未在真实余额账号上跑扣费/退款数据库联调。 | 待 Docker/WSL 挂载恢复后准备测试用户、余额和模型，记录脱敏事件 ID、扣费日志和退款日志。 |
| 本地依赖重建曾阻塞发布构建 | 历史记录显示 `node_modules` 链接层恢复后 `check-types` 和 `build:publish` 通过；若后续再次缺少 optional native binding 或根链接，优先在人工确认后完成一次干净的 pnpm 安装再跑构建。 | 保留构建验证记录；浏览器交互 smoke 仍需等待主站 node 容器完成全仓 build/start。 |
| 主站公共模块 DI 回归 | 通知/微信/认证链路异常会阻断所有插件真实 E2E，而不只是小镇。 | 根 `AGENTS.md` 已记录主系统服务复用规则；保留 `packages/api/src/common/modules/wechat/wechat-module-boundary.test.mjs`，后续公共模块改动先跑该边界测试和 `@buildingai/api check-types`。 |
| 浏览器自动化环境缺口 | 无法用当前 Codex Browser 或本机 Playwright 生成新的桌面/移动截图证据，阻断视觉 QA 和真实交互 smoke。 | 先恢复 Playwright Chromium 或可连接浏览器，再按根 `AGENTS.md` 的浏览器 QA 规则确认端口、标题、业务文案和截图状态。 |
| Console 菜单图标白名单 | 菜单图标已从动态图库收敛为主系统静态白名单，并有 `@buildingai/ui` 包级测试覆盖；新插件若使用未登记图标会回退为帮助图标。 | 新增 Console 菜单图标时同步扩展主系统白名单和测试，避免退回动态图标方案。 |

## 下一步

| 任务 | 范围/文件 | 具体步骤 | 验收 |
|---|---|---|---|
| P1 真实浏览器交互 smoke | Web 主场景、`TownService`、浏览器 QA 环境 | 先恢复 Playwright Chromium、系统浏览器或 Codex Browser 连接；确认端口确属 `echoflow-ai-town` 后，在主系统插件容器完成创建存档 -> 经营餐馆/拜访居民/探索街区 2 到 3 次行动 -> 休息日结 -> 第二天变化；同时检查控制台错误、首屏布局、抽屉焦点和移动端可操作区域。 | 记录真实存档 ID、行动序列、事件标题、资源 before/after、日结变化、桌面/移动截图和浏览器状态；没有新截图或浏览器运行证据时保持 blocked，不声明端到端通过。 |
| P1 真实账务 smoke | `src/api/modules/town/*`、主站余额、真实模型 | 使用测试用户和余额覆盖今日计划、居民聊天、探索导演三类动作的免费、真实模型成功扣费、fallback 不扣费、provider 失败退款和退款异常记录。 | 记录脱敏事件 ID、`AccountLog` 扣费/退款事实、fallback 标记和用户端账务 chip；未跑真实余额前不声明真实闭环。 |
| P2 规则与记忆测试补强 | `tests/*`、规则服务、记忆压缩、计费幂等 | 补世界规则、关系推进、任务进度、AI fallback、记忆压缩和计费幂等 focused tests。 | 测试覆盖新增规则且不把运营内容内联回 service；失败输出能定位 catalog、规则或计费边界。 |
