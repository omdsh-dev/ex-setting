# @deepseek-ai/dsh-ex-setting — ui-settings-plugins

English | [中文](../README.zh.md)

The automatic Web configuration surface. Every settings namespace the host wire serves and every mounted plugin whose cordis.yml row carries a `Config` schema is projected into the Settings dialog's scrollable first-level navigation. Settings and composition sources retain source-prefixed identities because a namespace carries no owner metadata that proves composition-row ownership; label collisions fall back to the composition id or a `Config` suffix. Selecting a row opens only that source's editor in the detail column, with no aggregate Plugins page. With the [web-config-crawler](web-config-crawler.md) plugin mounted (the shipped web composition does), these rows are discovered automatically and need no per-plugin opt-in.

Each settings-namespace editor renders its serialized schemastery schema as fields (string/number/boolean/union select, nested objects, and JSON for complex values), marks secret-role fields as password inputs with a configured placeholder, offers per-field reset back to the composition base, and writes edits as path ops against the stored user section with the read `expectedRevision` — a stale write surfaces the conflict copy and reloads. Namespaces whose `applies` is `restart` carry a restart notice; a read-only provider disables every control. A composition row uses the same editor: writes are path ops the host applies to the current resolved configuration (stored secrets survive), the row is persisted into the personal `$DSH_HOME/config.yaml` overlay, and the row's reset removes it entirely so the next boot reverts to the lower composition layers. Composition changes are restart-required.

The navigation lists exactly what the host serves: mounting the crawler is the deployment's explicit decision to expose all user-adjustable plugin settings over the loopback-only configuration plane.

## Model Experience

None, as the plugin renders browser settings UI; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **No per-namespace opt-out** — every namespace and composition row the host serves appears; a future deny list would let a deployment omit specific navigation rows.
- **Overlay rewrites drop comments** — the composition write path round-trips the personal config file through YAML, so hand-written comments in `$DSH_HOME/config.yaml` are not preserved once a composition edit lands.
- **Required secrets validate redacted** — a composition row whose `Config` marks a secret field required cannot be saved through the redacted editor (the wire never carries the value); optional secret fields edit normally.
