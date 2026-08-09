# `@deepseek-ai/dsh-ex-setting`

[English](README.md) | 中文

自动 DSH Web 设置组合包。它把宿主侧配置 crawler 和浏览器设置导航放在同一个外部包中：host 枚举已注册的 settings namespace 和带 schema 的 composition row，client 把它们投影为一级设置区段和编辑器。

## 仓库结构

```text
package.json              # host/client 包以及 dsh.bundle/dshClient 清单
cordis.patch.yml          # 挂载 crawler 的 profile 层
src/index.ts              # host crawler 插件
src/client/               # 浏览器设置页
src/invariant.ts          # crawler invariant companion
lib/                      # 生成的 host/client 产物
legacy/                   # 旧 DSH 快照的宿主接线补丁，仅作迁移资料
docs/                     # host 和 client 协议详细说明
tests/host/                # crawler 和 composition 测试
tests/client/              # browser store 和 section 测试
```

两个 runtime face 共享一个 package identity，因此 Git/profile 安装只有一个 root 产物。浏览器 face 通过 `@deepseek-ai/dsh-ex-setting/client` 导出，并由 `dshClient` 清单选择。

## 组合行为

安装组合包后加入 `web-config-crawler` 行，表示部署决定通过 Web 配置面暴露所有已注册 settings namespace 和带 schema 的 composition row。profile 可以关闭：

```yaml
- id: web-config-crawler
  disabled: true
```

Crawler 会脱敏 secret，按路径应用并通过 schema resolve 编辑，持久化完整 row 到个人 overlay，并通过删除 row 恢复下层组合。浏览器页面保持 settings namespace 与 composition row 的来源区分，并提供 schema 字段、secret、reset、revision conflict、restart notice 和失效刷新。

新的 bundle patch 只负责组合这个包。Settings/composition wire 协议、API proxy handler、slot host 和 browser shell 必须由 profile 使用的 DSH 版本提供；旧宿主接线 diff 保留在 `legacy/` 中，不属于新的 bundle 契约。

## 开发

完整 typecheck 需要 sibling checkout：

```text
~/git/deepseek-harness
~/git/ex-setting
```

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
```

`prepare` 直接从 `src/` 构建 host 和 browser entry，因此 Git 安装不需要 sibling project references。pnpm 10 可能要求 profile 允许 prepare 脚本；只应批准固定且可信的 checkout。

## 已知限制

- 原生 Zod composition Config 可以通过文件配置，但通用编辑器不会渲染；编辑器要求 schemastery `toJSON()`。
- Crawler 的范围有意较宽；不希望自动编辑 composition 的部署应禁用该行并保留 gateway allowlist 行为。
- 旧 DSH 快照需要使用 `legacy/` 中的宿主接线补丁，因为 bundle 不能新增缺失的 wire 或 API 源码接缝；当前 `master` 也还没有 `composition` client face，完整 typecheck 需要兼容的 web-config 宿主改动（例如 `a9c30fa4`）。
