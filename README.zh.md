# `@deepseek-ai/dsh-ex-setting`

[English](README.md) | 中文

自动 DSH Web 设置组合包。它把宿主侧配置 crawler 和浏览器设置导航放在同一个外部包中：host 枚举已注册的 settings namespace 和带 schema 的 composition row，client 把它们投影为一级设置区段和编辑器。

## 仓库结构

```text
package.json              # host/client 包以及 dsh.bundle/dshClient 清单
cordis.patch.yml          # 挂载 crawler 的 profile 层
src/index.ts              # host crawler 插件(服务提供 + Fabric handler 绑定)
src/routes.ts             # crawler 自有的 webserver composition 路由
src/nav-scroll.ts         # 浏览器 bundle 重写契约(serveBrowserTransform)
src/invariant.ts          # crawler invariant companion
src/client/               # 浏览器设置页(store、section、crawler wire)
lib/                      # 生成的 host/client 产物
docs/                     # host 和 client 协议详细说明
tests/host/               # crawler、route、invariant、loader 与 Fabric composition 测试
tests/client/             # browser store 和 section 测试
patches/                  # host patch 契约(为空:包外零改动)
scripts/                  # verify:self-contained、host patch 提取/应用
.agents/skills/           # dsh-plugin-* 贡献工作流
```

两个 runtime face 共享一个 package identity，因此 Git/profile 安装只有一个 root 产物。浏览器 face 通过 `@deepseek-ai/dsh-ex-setting/client` 导出，并由 `dshClient` 清单选择。

## 组合行为

安装组合包后加入 `web-config-crawler` 行，表示部署决定通过 Web 配置面暴露所有已注册 settings namespace 和带 schema 的 composition row。profile 可以关闭：

```yaml
- id: web-config-crawler
  disabled: true
```

Crawler 会脱敏 secret，按路径应用并通过 schema resolve 编辑，持久化完整 row 到个人 overlay，并通过删除 row 恢复下层组合。浏览器页面保持 settings namespace 与 composition row 的来源区分，并提供 schema 字段、secret、reset、revision conflict、restart notice 和失效刷新。

## 外部零改动设计

本组合包**零包外宿主改动**，靠三个机制实现：

- **Fabric 暴露加宽** — crawler 是 Fabric 依赖行:其 `cordis.patch.yml` 行在自身 config 下携带静态 `web-config-crawler/exposed-namespaces` stub 且默认 disabled,`fabric-dsh` 启动器会在启动时启用 Fabric 依赖行。普通 `dsh` 启动因此完全跳过本 bundle(应用照常运行、crawler 不加载);fabric-dsh 启动则在 hooks 就位后加载它,gateway 私有的 `exposedNamespaces()` 决策在加载时被改写,crawler 挂载时绑定对应的 `after` handler,`required` stub 让"transform 未绑定"的 fabric-dsh 启动直接失败(见 `docs/web-config-crawler.md`)。
- **crawler 自有的 composition 路由** — 浏览器侧通过 crawler 自己的 webserver 路由(`/dsh-config/crawler/composition`，`src/routes.ts`)读写 composition row，而不是 gateway RPC 域，因此写路径不向 `apiproxy` 或 `connection` 添加任何东西。
- **served 浏览器重写** — crawler 通过 `serveBrowserTransform` 提供 `ui-settings-general` client bundle，把 `SettingsRoot` 重写为发布 `web-config-crawler/nav-scroll`；浏览器侧注册对应的 `before` handler 注入对话框导航滚动样式(见 `docs/ui-settings-plugins.md`)。

Settings/composition wire 协议、API proxy handler、slot host 和 browser shell 由 profile 使用的 DSH 版本提供。

## 开发

宿主包(`@deepseek-ai/dsh-*`、`@deepseek-ai/cordis`)直接从 npm registry 安装:每个运行时 import 都以 `^0.1.0-rc.0` 系列声明 peer + dev 双依赖,开发解析全部来自本仓库自己的 `node_modules`——不再需要 sibling checkout。devDependencies 同时列全了测试专用宿主树的 peer 闭包(apiproxy 组合测试会 import 真实网关)。

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
pnpm run verify:self-contained
```

`prepare` 直接从 `src/` 构建 host 和 browser entry，因此 Git 安装不需要 sibling project references。pnpm 10 可能要求 profile 允许 prepare 脚本；只应批准固定且可信的 checkout。

## CI

仓库自带两个 GitHub Actions 工作流：

- `.github/workflows/ci.yml` — 每次推送到 `main` 与每个 pull request：冻结 lockfile 安装、`verify:self-contained`、typecheck、测试、构建与 `prepare`。
- `.github/workflows/release.yml` — 每次推送到 `main`：构建并 `prepare`、`pnpm pack` 打包 tarball，发布到以 `package.json` 版本号命名的 GitHub Release（`v<version>`）。提升 `version` 即发布新版本；同版本再次推送会刷新该 Release 的产物。

## 模型体验

本组合包不添加模型可见的提示文本或工具。它只通过 loopback Web 设置面暴露配置；DSH settings、composition、session 与 permission 服务保留日志、脱敏和授权语义。

## 已知限制

- 原生 Zod composition Config 可以通过文件配置，但通用编辑器不会渲染；编辑器要求 schemastery `toJSON()`。
- Crawler 的范围有意较宽；不希望自动编辑 composition 的部署应禁用该行并保留 gateway allowlist 行为。
