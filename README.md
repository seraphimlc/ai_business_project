# 跨境业务场景运营系统 Demo

这是一个场景优先的跨境业务运营系统 Demo。用户从业务目标进入，处理真实业务对象，确认结果后写回正式数据，并继续下一步业务动作。产品侧不以技术能力名词组织导航。

## 运行

```bash
npm install
npm run dev
```

验证命令：

```bash
npm run test -- --run
npm run build
npm run lint
```

## 演示入口

- `/`：场景中心首页，业务目标优先，任务和业务数据为辅助信息
- `/product`：商品列表
- `/product/product-demo`：商品经营工作台，展示候选内容、确认写回、版本、合规和处理记录
- `/mini-program`：微信小程序关键页面预览，与 Web 使用同一份商品状态
- `/leads`：线索经营关键路径
- `/compliance`：合规处理关键路径
- `/quotation`：询价与报价关键路径
- `/order`：订单与履约关键路径
- `/catalog`：温州 42 个和南京 12 个原始场景的统一目录
- `/architecture/product`：产品架构图
- `/architecture/system`：系统架构图
- `/architecture/objects`：五条主线与业务对象关系图
- `/admin`：平台运营工作台（企业入驻审核、服务商管理、项目场景配置、服务需求池、运营数据与风险）
- `/admin/enterprises`：企业管理
- `/admin/enterprises/org-enterprise-ningbo`：企业详情（含待审核入驻演示）
- `/admin/providers`：服务商管理
- `/admin/projects`：项目场景配置（9810 / 9710 / 1039 模式承载）
- `/admin/services`：服务需求池（受理与分配服务商）
- `/admin/data`：运营数据与风险概览

左侧「当前工作区」可在企业工作区与平台运营工作区之间切换。

## Demo 角色

- 企业负责人：确认关键结果、处理合规和查看经营数据
- 商品运营人员：处理商品、素材和内容
- 服务商：只处理被分配的整改和材料提交，不确认企业正式数据
- 平台运营人员：在项目范围内查看企业、服务商和业务进度

## 底层业务规则

- 商品、线索、询价、报价、合规案件、订单等是长期业务对象，不是一次性文档输出。
- 场景处理先生成候选结果，确认后才写回正式对象。
- 写回校验组织、项目、角色、任务负责人和 source version；冲突不会静默覆盖。
- 正式写回生成版本、审计记录和下一步任务；失败候选保留并可重试。
- 商品合规由案件、风险、材料和复核共同决定；未完成时商品可以保留内容结果，但不能进入正常经营状态。
- 报价反馈与报价版本分开，修订会废弃旧版本但保留历史。
- 所有 Demo 数据保存在 namespaced localStorage，损坏或关系不完整时恢复到确定性 fixtures。

## 代码分层

- `src/domain/types.ts`：业务对象、状态和领域动作类型
- `src/domain/fixtures.ts`：确定性演示数据
- `src/domain/catalog.ts`：全量场景目录及项目来源映射
- `src/domain/reducer.ts`：唯一的本地业务状态变更入口
- `src/domain/store.tsx`：状态持久化、恢复与关系校验
- `src/domain/selectors.ts`：角色可见数据、进度和时间线
- `src/components/`：公共壳、状态、任务、对象和时间线组件
- `src/pages/`：首页、目录、商品样板、四条流程和架构页面

## Mock 与真实系统边界

当前 Demo 使用 fixtures、localStorage 和同步 reducer 模拟真实服务。真实版本可以保留同一业务契约，把 reducer 后面的本地状态服务替换为 API、数据库、文件存储、异步任务和外部连接适配器。外部数据源、渠道发布、真实文件处理和真实生成服务不属于本阶段实现范围。
