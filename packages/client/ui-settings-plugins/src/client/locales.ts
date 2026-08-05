/** Automatically crawled plugin-editor dictionaries. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'status.loadingNav': '正在加载插件设置',
  'status.emptyNav': '暂无插件设置',
  'status.errorNav': '插件设置加载失败',
  'status.empty': '当前没有可调整的插件设置。',
  'status.loading': '正在加载插件设置……',
  'status.loadFailed': '加载插件设置失败',
  'status.retry': '重试',
  'composition.remove': '恢复该行默认',
  'save': '保存',
  'saving': '保存中……',
  'saved': '已保存。',
  'reset': '恢复默认',
  'readOnly': '当前配置源为只读。',
  'restart': '重启后生效',
  'live': '立即生效',
  'restartNotice': '此配置声明为重启后生效；保存后请重启 DSH。',
  'conflict': '配置已被其他来源修改，请重新加载后再保存。',
  'invalidSchema': '插件提供的配置架构无法显示。',
  'invalidJson': 'JSON 格式无效',
  'jsonHint': '复杂值使用 JSON 编辑；保存前必须是有效 JSON。',
  'secretConfigured': '已配置（输入新值可替换）',
  'root': '配置',
} satisfies Record<string, string>

/** The settings namespace key union. */
export type SettingsKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'status.loadingNav': 'Loading plugin settings',
  'status.emptyNav': 'No plugin settings',
  'status.errorNav': 'Plugin settings failed to load',
  'status.empty': 'No adjustable plugin settings are available.',
  'status.loading': 'Loading plugin settings…',
  'status.loadFailed': 'Could not load plugin settings',
  'status.retry': 'Retry',
  'composition.remove': 'Reset this row',
  'save': 'Save',
  'saving': 'Saving…',
  'saved': 'Saved.',
  'reset': 'Reset',
  'readOnly': 'The current settings provider is read-only.',
  'restart': 'Restart required',
  'live': 'Applies immediately',
  'restartNotice': 'This setting applies after restart; restart DSH after saving.',
  'conflict': 'Settings changed elsewhere. Reload and save again.',
  'invalidSchema': 'The plugin supplied a schema that cannot be displayed.',
  'invalidJson': 'Invalid JSON',
  'jsonHint': 'Edit complex values as JSON; the value must be valid JSON before saving.',
  'secretConfigured': 'Configured (enter a new value to replace it)',
  'root': 'Settings',
} satisfies Record<SettingsKey, string>
