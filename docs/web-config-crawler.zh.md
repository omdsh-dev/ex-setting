# @deepseek-ai/dsh-ex-setting — web-config-crawler

[English](web-config-crawler.md) | 中文

部署层的显式选择：挂载本插件后，宿主 API 网关向 Web 客户端提供**全部**已注册 settings namespace——插件无需任何接入动作——并通过 crawler 自有的 webserver 路由暴露每个挂载插件的组合 `Config`（cordis.yml 行配置）。不挂载本插件时，网关仍可提供已注册 settings namespace，但 crawler 和 composition editor 不会挂载。

## 外部零改动设计

Crawler 不修改包外宿主代码：settings namespace 仍由 gateway 提供，composition 读写使用 `/dsh-config/crawler/composition`，路由只在 webserver 可用时注册。浏览器侧直接安装 fiber-owned 的语义化导航样式，不依赖宿主 bundle rewrite。

## 服务 API

- 提供 `ctx.webConfigCrawler`（`namespaces(): SettingsNamespace[]`）——活的 settings 注册表，按注册顺序，调用时实时解析，请求之间新挂载或卸载的 namespace 立即反映。Crawler 自己的 composition 路由和 invariant 使用这个接口。
- `compositionConfigs()`——每个组合行携带 `Config` schema 的挂载插件，脱敏后（与 settings seam 相同的结构化遍历）按注册顺序返回。
- `updateComposition(id, ops)`——对插件**当前**解析配置施加路径 op（wire 从未回传的 secret 得以保留），按 `Config` schema 校验，并把完整行写入个人 overlay。
- `removeComposition(id)`——从个人 overlay 移除该行，下次启动回退到更低组合层。

## 组合写入

个人 overlay 即每个界面都会应用的 `$DSH_HOME/config.yaml` 补丁层（爬取器 `overlayPath` 配置可覆盖默认值）。该文件中某行的 `config` 会整体替换该行的低层配置，因此爬取器总是写入完整解析配置（含默认值），并通过 YAML 往返重写文件、保留无关行。清空的 overlay 会被删除（不存在的 overlay 即无此层）。变更在下一次启动生效；个人配置监视器可能对部分行热应用，但重启是保证的契约。

## 安全立场

挂载本插件即显式决定把全部用户可调整插件设置暴露到配置平面。平面既有保护全部保留：每个响应都脱敏（`role('secret')` 值绝不搭乘协议）、写入带版本冲突检测、浏览器载体把整个配置平面限制为仅接受回环地址同源请求。不变式伴生插件在两个服务都挂载时断言爬取覆盖注册表。

## Model Experience

无，因为爬取器从不触及模型请求。

#### KV Cache 影响

无。

## 已知限制与暂缓事项

- **仅限可渲染 schema 的 Config**——组合行的 `Config` 若不提供 schemastery 的 `toJSON()` 契约，就仍只能通过文件配置；通用 Web 编辑器无法重建原生 Zod schema。
- **无按 namespace 退出机制**——挂载后每个已注册 namespace 都会被服务。未来的 `deny` 列表可让部署者把特定 namespace 钉回 `settings-not-exposed`。
