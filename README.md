# dsh Web 配置插件

这是从最新 DeepSeek Harness `feat-web-config` worktree 中重新分离出的独立发布目录。

当前上游提交：`5b9b8726 feat(web): expose crawled plugin settings in navigation`。

宿主补丁基线：官方 0804 snapshot 对应的 DSH `master` `b4b67f0`。

## 包含内容

```text
packages/host/web-config-crawler/       Host 配置爬取插件
packages/client/ui-settings-plugins/    Web 配置导航和编辑器插件
patches/web-config-plugin.patch         DSH 宿主接缝补丁
```

两个插件分别是：

```text
@deepseek-ai/dsh-host-web-config-crawler
@deepseek-ai/dsh-client-ui-settings-plugins
```

## 当前功能

### Host crawler

挂载后，host settings wire 会自动枚举并服务所有注册的 settings namespace，同时枚举带有 schemastery `Config.toJSON()` schema 的 composition rows。secret 字段始终 redacted，配置写入使用 revision 检查，并持久化到个人 `$DSH_HOME/config.yaml` overlay。

不具备 schemastery `toJSON()` 的原生 Zod composition Config 会保留为 file-only，不会被通用 Web 编辑器渲染。

### Web settings page

Settings 页面现在使用独立的一级导航显示每个来源：

- settings namespace 使用来源前缀标识
- composition row 使用 composition id 标识
- label 冲突时回退到 composition id 或 `Config` 后缀
- 选择导航项后只在详情列打开对应编辑器
- 不再渲染聚合的 Plugins 页面

编辑器根据 schema 渲染字段，支持 secret、reset、revision conflict、restart notice 和 composition overlay 写入。插件作者不需要增加 `web.expose` opt-in。

挂载 crawler 是部署层面的显式决定：它会通过 loopback-only 配置面暴露所有注册的可配置插件设置。没有挂载 crawler 时，host gateway 保持默认 allowlist 行为。

完整协议和限制说明见两个包的 README：

- `packages/host/web-config-crawler/README.md`
- `packages/host/web-config-crawler/README.zh.md`
- `packages/client/ui-settings-plugins/README.md`
- `packages/client/ui-settings-plugins/README.zh.md`

## 安装到 DSH

以下命令在目标 DSH 仓库根目录执行。补丁基于 `master` `b4b67f0`；其他基线需要先确认补丁可以安全应用。

### 1. 复制两个插件包

```sh
cp -a /path/to/web-config-plugin/packages/host/web-config-crawler \
  packages/host/
cp -a /path/to/web-config-plugin/packages/client/ui-settings-plugins \
  packages/client/
```

### 2. 应用宿主补丁

```sh
git apply --check /path/to/web-config-plugin/patches/web-config-plugin.patch
git apply /path/to/web-config-plugin/patches/web-config-plugin.patch
```

补丁包含：

- `settings.*` 和 `composition.*` wire 接口接线
- connection client API 与 fixtures
- API proxy schema、handler、拒绝码映射和测试
- Settings 一级导航 shell 的样式和文档接缝
- `tsconfig` references 与 path aliases
- `apps/cli` 依赖和 Web composition rows
- Web 配置 e2e 测试、snapshots 和 host README

补丁不包含两个插件包本体，也不修改仓库根 `package.json` 的开发工具依赖或 `pnpm-lock.yaml`；复制插件后由目标 workspace 重新生成 lockfile。

### 3. 安装并构建

```sh
pnpm install
pnpm exec tsc -b packages/host/web-config-crawler
pnpm --filter @deepseek-ai/dsh-client-ui-settings-plugins bundle
```

补丁默认把两个插件加入 `apps/cli/config/web.cordis.yml`。如果某个部署不希望开启自动配置爬取，可以移除 `web-config-crawler` row；此时 gateway 会恢复默认 allowlist。

## 发布到 GitHub

本目录目前只完成本地整理，没有配置远程仓库，也没有推送。

在 GitHub 创建目标仓库后执行：

```sh
cd /home/raum/deepseek-harness/web-config-plugin
git add .
git commit -m 'feat: refresh web-config plugins'
git branch -M main
git remote add origin <GitHub 仓库 URL>
git push -u origin main
```

两个 package 均沿用 BSD-3-Clause 许可。发布到组织仓库时，请按组织要求补充仓库级 LICENSE 和版权信息。
