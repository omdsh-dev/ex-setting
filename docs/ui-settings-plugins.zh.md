# @deepseek-ai/dsh-ex-setting — ui-settings-plugins

[English](../README.md) | 中文

全自动 Web 配置界面：宿主 wire 服务的每个 settings namespace，以及每个组合行携带 `Config` schema 的挂载插件，都会投影到设置对话框左侧可滚动的一级导航中。Settings 与 composition 来源保留带来源前缀的身份，因为 namespace 不携带足以证明组合行归属的 owner 元数据；label 冲突时回退到组合 id 或 `Config` 后缀。选中后，右侧只打开该来源的编辑器，不保留「插件设置」集合页。挂载 [web-config-crawler](web-config-crawler.md) 插件时（随附的 Web 组合默认挂载），这些导航项完全自动发现，插件无需任何接入动作。

每个 settings namespace 编辑器把序列化 schemastery schema 渲染为字段（字符串/数字/布尔/联合下拉、嵌套对象，复杂值用 JSON），secret 角色字段显示为带「已配置」占位的密码输入框，支持逐字段恢复为组合 `base`，并以读取时的 `expectedRevision` 把编辑写成针对已存用户分节的路径 op——过期写入显示冲突文案并重新加载。`applies` 为 `restart` 的 namespace 带有重启提示；只读 provider 禁用所有控件。组合行使用同一编辑器：写入是宿主对当前解析配置施加的路径 op（已存 secret 得以保留），行被持久化进个人 `$DSH_HOME/config.yaml` overlay，行的「恢复该行默认」整体移除该行，下次启动回退到更低组合层。组合变更需要重启生效。

导航只列出宿主实际服务的内容：挂载爬取器即部署者显式决定把全部用户可调整插件设置暴露到仅限回环的配置平面。

## 模型体验

无。该插件渲染浏览器设置 UI；这里没有任何内容进入模型请求。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与暂缓事项

- **无按 namespace 退出机制**——宿主服务的每个 namespace 与组合行都会出现；未来的 deny 列表可让部署者省略特定导航项。
- **overlay 重写会丢弃注释**——组合写入路径对个人配置文件做 YAML 往返，`$DSH_HOME/config.yaml` 里的手写注释在组合编辑落地后不再保留。
- **必填 secret 校验受阻**——`Config` 中标记为 required 的 secret 字段无法通过脱敏编辑器保存（wire 绝不携带该值）；可选 secret 字段可正常编辑。
