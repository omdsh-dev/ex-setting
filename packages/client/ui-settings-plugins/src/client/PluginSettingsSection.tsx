/**
 * Schema-driven detail editor shared by first-level plugin settings entries.
 * Settings namespaces edit the raw user layer with path ops, while composition
 * rows apply equivalent ops to the current resolved row; redacted secrets stay
 * absent unless the user explicitly replaces or resets them.
 */

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  CompositionNamespaceView, IApiClient, SettingsNamespaceView, SettingsPathOpView,
} from '@deepseek-ai/dsh-client-connection/client'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import {
  deletePath, getPath, hasPath, rehydrateSchema, setPath, validateDraft,
} from '@deepseek-ai/dsh-client-schema-form'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  PluginSettingsEntryKey, PluginSettingsState,
} from './plugin-settings-store.ts'
import { pluginSettingsEntry } from './plugin-settings-store.ts'
import styles from './PluginSettingsSection.module.css'

/** Registration-side business face shared by every dynamic plugin section. */
export interface PluginSettingsSectionInjected {
  /** Catalog snapshot bound by the renderer as usePluginSettings. */
  hooks: { pluginSettings: SnapshotStore<PluginSettingsState> }
  /** Reload both crawler domains. */
  reload: () => Promise<void>
  /** Persist settings-namespace path ops. */
  mutateSettings: IApiClient['settings']['mutate']
  /** Persist composition-row path ops. */
  updateComposition: IApiClient['composition']['update']
  /** Remove one composition row from the personal overlay. */
  removeComposition: IApiClient['composition']['remove']
}

/** Props common to every dynamic plugin or status section. */
export type PluginSettingsSectionCommonProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'settings-plugins'>
  & InjectFace<PluginSettingsSectionInjected>

/** Props of one registration-bound plugin editor. */
export type PluginSettingsSectionProps = PluginSettingsSectionCommonProps & {
  /** Stable source key closed over by this section's registration. */
  pluginKey: PluginSettingsEntryKey
}

/** One editor write outcome: undefined means committed. */
export type WriteOutcome = { conflict: boolean; message: string } | undefined

/** The write path an editor card uses; overrides the settings-mutate default. */
export type WriteFn = (
  ops: SettingsPathOpView[],
  expectedRevision: number | undefined,
) => Promise<WriteOutcome>

type JsonRecord = Record<string, unknown>

type SchemaNodeLike = {
  type?: string
  meta?: Record<string, unknown>
  value?: unknown
  dict?: Record<string, SchemaNodeLike>
  inner?: SchemaNodeLike
  list?: SchemaNodeLike[]
}

interface FieldProps {
  node: SchemaNodeLike
  path: readonly string[]
  namespace: SettingsNamespaceView
  draft: JsonRecord
  disabled: boolean
  t: PluginSettingsSectionCommonProps['t']
  onSet: (path: readonly string[], value: unknown) => void
  onReset: (path: readonly string[]) => void
  onJsonError: (path: readonly string[], message: string | undefined) => void
  jsonErrors: ReadonlyMap<string, string>
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cloneRecord(value: unknown): JsonRecord {
  return isRecord(value) ? structuredClone(value) : {}
}

function pathKey(path: readonly string[]): string {
  return JSON.stringify(path)
}

function samePath(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((segment, index) => segment === right[index])
}

function secretAt(namespace: SettingsNamespaceView, path: readonly string[]): { set: boolean } | undefined {
  return namespace.secrets.find(secret => samePath(secret.path, path))
}

function labelOf(segment: string): string {
  const spaced = segment.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ')
  return spaced.length === 0 ? segment : spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function descriptionOf(node: SchemaNodeLike): string | undefined {
  const description = node.meta?.['description']
  if (typeof description === 'string') return description
  if (!isRecord(description)) return undefined
  for (const key of ['en', 'zh', 'zh-CN']) {
    const text = description[key]
    if (typeof text === 'string') return text
  }
  return undefined
}

function displayValue(
  namespace: SettingsNamespaceView,
  draft: JsonRecord,
  path: readonly string[],
): unknown {
  return hasPath(draft, path) ? getPath(draft, path) : getPath(namespace.value, path)
}

function isSecretField(namespace: SettingsNamespaceView, node: SchemaNodeLike, path: readonly string[]): boolean {
  return secretAt(namespace, path) !== undefined || node.meta?.['role'] === 'secret'
}

function choicesOf(node: SchemaNodeLike): unknown[] | undefined {
  if (node.type === 'const') return [node.value]
  if (node.type !== 'union' || node.list === undefined) return undefined
  const choices = node.list
    .filter(item => item.type === 'const')
    .map(item => item.value)
  return choices.length === node.list.length && choices.length > 0 ? choices : undefined
}

function serializeJson(value: unknown): string {
  if (value === undefined) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    /* v8 ignore next -- wire and draft values are JSON-shaped; only a circular reference could throw */
    return ''
  }
}

function JsonField({ props, value }: { props: FieldProps; value: unknown }): ReactNode {
  const { node, path, disabled, onSet, onJsonError, t } = props
  const jsonError = props.jsonErrors.get(pathKey(path))
  const [text, setText] = useState(() => serializeJson(value))
  useEffect(() => { setText(serializeJson(value)) }, [value])
  return (
    <>
      <textarea
        className={styles['jsonInput']}
        value={text}
        rows={5}
        disabled={disabled}
        aria-label={labelOf(path[path.length - 1] ?? 'value')}
        onChange={(event) => {
          const nextText = event.target.value
          setText(nextText)
          try {
            const parsed = nextText.length === 0 ? undefined : JSON.parse(nextText) as unknown
            onSet(path, parsed)
            onJsonError(path, undefined)
          } catch (error) {
            /* v8 ignore next -- JSON.parse only throws SyntaxError, an Error; the string arm guards a hostile host */
            onJsonError(path, error instanceof Error ? error.message : String(error))
          }
        }}
      />
      {jsonError === undefined ? null : <p className={styles['fieldError']}>{`${t('invalidJson')}: ${jsonError}`}</p>}
      {node.type === 'dict' ? <p className={styles['fieldHint']}>{t('jsonHint')}</p> : null}
    </>
  )
}

function Field({
  node, path, namespace, draft, disabled, t, onSet, onReset, onJsonError, jsonErrors,
}: FieldProps): ReactNode {
  const type = node.type ?? 'any'
  const secret = isSecretField(namespace, node, path)
  const secretState = secretAt(namespace, path)
  const overridden = hasPath(draft, path)
  const canReset = overridden || secretState?.set === true
  const value = displayValue(namespace, draft, path)
  // schemastery's constructor always materializes meta ({} when absent), so
  // the fallback is unreachable for rehydrated nodes.
  /* v8 ignore next -- the empty-object arm is unreachable by construction */
  const meta = node.meta ?? {}
  const description = descriptionOf(node)
  const choices = choicesOf(node)

  if (type === 'object' && node.dict !== undefined) {
    return (
      <fieldset className={styles['group']}>
        <legend className={styles['groupTitle']}>{labelOf(path[path.length - 1] ?? t('root'))}</legend>
        {description === undefined ? null : <p className={styles['fieldHint']}>{description}</p>}
        <div className={styles['groupBody']}>
          {Object.entries(node.dict).map(([key, child]) => (
            <Field
              key={key}
              node={child}
              path={[...path, key]}
              namespace={namespace}
              draft={draft}
              disabled={disabled}
              t={t}
              onSet={onSet}
              onReset={onReset}
              onJsonError={onJsonError}
              jsonErrors={jsonErrors}
            />
          ))}
        </div>
      </fieldset>
    )
  }

  const fieldLabel = labelOf(path[path.length - 1] ?? t('root'))
  const controlId = `settings-${namespace.ns}-${path.join('-') || 'root'}`
  const reset = canReset ? (
    <button type="button" className={styles['resetButton']} disabled={disabled} onClick={() => { onReset(path) }}>
      {t('reset')}
    </button>
  ) : null
  const label = (
    <div className={styles['fieldHeader']}>
      <label htmlFor={controlId} className={styles['fieldLabel']}>{fieldLabel}</label>
      {meta['required'] === true ? <span className={styles['required']}>*</span> : null}
      {reset}
    </div>
  )
  const hint = description === undefined ? null : <p className={styles['fieldHint']}>{description}</p>

  if (choices !== undefined) {
    const selected = choices.some(choice => JSON.stringify(choice) === JSON.stringify(value)) ? value : choices[0]
    if (type === 'const') {
      return <div className={styles['field']}>{label}{hint}<output id={controlId} className={styles['readonlyValue']}>{String(selected)}</output></div>
    }
    return (
      <div className={styles['field']}>
        {label}
        {hint}
        <select
          id={controlId}
          className={styles['input']}
          value={typeof selected === 'string' ? selected : JSON.stringify(selected)}
          disabled={disabled}
          onChange={(event) => {
            const next = choices.find(choice => (typeof choice === 'string' ? choice : JSON.stringify(choice)) === event.target.value)
            onSet(path, next)
          }}
        >
          {choices.map((choice) => {
            const optionValue = typeof choice === 'string' ? choice : JSON.stringify(choice)
            return <option key={optionValue} value={optionValue}>{String(choice)}</option>
          })}
        </select>
      </div>
    )
  }

  if (type === 'boolean') {
    return (
      <div className={styles['field']}>
        <label className={styles['checkboxLabel']}>
          <input
            id={controlId}
            type="checkbox"
            checked={value === true}
            disabled={disabled}
            onChange={(event) => { onSet(path, event.target.checked) }}
          />
          <span>{fieldLabel}</span>
        </label>
        {hint}
        {reset}
      </div>
    )
  }

  if (type === 'string') {
    // A string-typed field resolves to a string or undefined: the seam rejects
    // any other stored shape at registration, and the input only ever produces
    // strings, so the JSON stringify arm is unreachable.
    /* v8 ignore next -- the non-string, non-undefined arm is unreachable by construction */
    const inputValue = secret && !overridden
      ? ''
      : typeof value === 'string' ? value : value === undefined ? '' : JSON.stringify(value)
    return (
      <div className={styles['field']}>
        {label}
        {hint}
        <input
          id={controlId}
          className={styles['input']}
          type={secret ? 'password' : 'text'}
          value={inputValue}
          placeholder={secret && secretState?.set === true ? t('secretConfigured') : undefined}
          disabled={disabled}
          onChange={(event) => { onSet(path, event.target.value === '' && secret ? undefined : event.target.value) }}
        />
      </div>
    )
  }

  if (type === 'number') {
    // A number-typed field always resolves to a number: schemastery defaults it
    // to 0 and the seam rejects non-number stored sections at registration.
    /* v8 ignore next -- the non-number arm is unreachable by construction */
    const numberValue = typeof value === 'number' ? String(value) : ''
    return (
      <div className={styles['field']}>
        {label}
        {hint}
        <input
          id={controlId}
          className={styles['input']}
          type="number"
          value={numberValue}
          min={typeof meta['min'] === 'number' ? meta['min'] : undefined}
          max={typeof meta['max'] === 'number' ? meta['max'] : undefined}
          step={typeof meta['step'] === 'number' ? meta['step'] : 'any'}
          disabled={disabled}
          onChange={(event) => {
            if (event.target.value === '') onSet(path, undefined)
            else onSet(path, Number(event.target.value))
          }}
        />
      </div>
    )
  }

  return (
    <div className={styles['field']}>
      {label}
      {hint}
      <JsonField props={{
        node, path, namespace, draft, disabled, t, onSet, onReset, onJsonError, jsonErrors,
      }} value={value} />
    </div>
  )
}

function mergeForValidation(base: unknown, user: unknown): JsonRecord {
  const left = isRecord(base) ? base : {}
  // The user side is always a JsonRecord: callers pass a draft object and the
  // recursive call only descends into values that are records.
  /* v8 ignore next -- the empty-object arm is unreachable by construction */
  const right = isRecord(user) ? user : {}
  const merged: JsonRecord = { ...left }
  for (const [key, value] of Object.entries(right)) {
    merged[key] = isRecord(merged[key]) && isRecord(value)
      ? mergeForValidation(merged[key], value)
      : value
  }
  return merged
}

function equalJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function diffUserOps(
  path: readonly string[],
  before: unknown,
  after: unknown,
  output: Array<{ op: 'set'; path: string[]; value: unknown } | { op: 'unset'; path: string[] }>,
): void {
  if (isRecord(before) && isRecord(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)])
    for (const key of keys) diffUserOps([...path, key], before[key], after[key], output)
    return
  }
  if (after === undefined) {
    // The union of both key sets reaches this arm only when the key existed in
    // `before`, so `before` is always defined here.
    /* v8 ignore next -- the undefined-before arm is unreachable by construction */
    if (before !== undefined) output.push({ op: 'unset', path: [...path] })
    return
  }
  if (before === undefined || !equalJson(before, after)) output.push({ op: 'set', path: [...path], value: after })
}

/**
 * The path-addressed ops one namespace card applies: a recursive diff of the
 * redacted user layer against the draft, plus explicit unset ops for every
 * cleared secret. The diff is symmetric — a key present in `before` but absent
 * from `after` becomes `unset`, so a secret the wire never returned is only
 * touched when the user explicitly cleared it.
 * @param namespace - the redacted descriptor the draft was edited from.
 * @param draft - the edited user-layer subtree.
 * @param clearedSecrets - encoded paths of set secrets the user reset.
 * @returns ordered ops; empty when nothing changed.
 */
export function userOpsFor(
  namespace: SettingsNamespaceView,
  draft: JsonRecord,
  clearedSecrets: ReadonlySet<string>,
): Array<{ op: 'set'; path: string[]; value: unknown } | { op: 'unset'; path: string[] }> {
  const ops: Array<{ op: 'set'; path: string[]; value: unknown } | { op: 'unset'; path: string[] }> = []
  diffUserOps([], namespace.user, draft, ops)
  for (const encoded of clearedSecrets) {
    const path = JSON.parse(encoded) as string[]
    // The user layer never carries secret paths (redaction strips them), so the
    // diff can never have emitted an op for one of these paths already.
    /* v8 ignore next -- the duplicate-guard arm is unreachable by construction */
    if (!ops.some(op => samePath(op.path, path))) ops.push({ op: 'unset', path })
  }
  return ops
}

function NamespaceEditor({
  namespace, writable, mutateSettings, t, onChanged, write, headerExtra, title,
}: {
  namespace: SettingsNamespaceView
  writable: boolean
  mutateSettings: PluginSettingsSectionInjected['mutateSettings']
  t: PluginSettingsSectionCommonProps['t']
  onChanged: () => void
  /** Alternative write path (composition rows); defaults to settings.mutate. */
  write?: WriteFn
  /** Extra header content beside the applies badge (composition reset). */
  headerExtra?: ReactNode
  /** Display heading; defaults to the settings namespace. */
  title?: string
}): ReactNode {
  const root = useMemo(() => rehydrateSchema(namespace.schema), [namespace.schema])
  const schema = root as unknown as SchemaNodeLike
  const [draft, setDraft] = useState<JsonRecord>(() => cloneRecord(namespace.user))
  const [clearedSecrets, setClearedSecrets] = useState<Set<string>>(() => new Set())
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | undefined>(undefined)
  const [saved, setSaved] = useState(false)
  const [jsonErrors, setJsonErrors] = useState<Map<string, string>>(new Map())
  const disabled = busy || !writable

  const setValue = (path: readonly string[], value: unknown): void => {
    setSaved(false)
    setClearedSecrets((current) => {
      const next = new Set(current)
      next.delete(pathKey(path))
      return next
    })
    setDraft(current => value === undefined ? deletePath(current, path) : setPath(current, path, value))
  }
  const resetValue = (path: readonly string[]): void => {
    setSaved(false)
    setDraft(current => deletePath(current, path))
    if (secretAt(namespace, path)?.set === true) {
      setClearedSecrets(current => new Set(current).add(pathKey(path)))
    }
  }
  const setJsonError = (path: readonly string[], message: string | undefined): void => {
    setJsonErrors((current) => {
      const next = new Map(current)
      if (message === undefined) next.delete(pathKey(path))
      else next.set(pathKey(path), message)
      return next
    })
  }

  const apply = async (): Promise<void> => {
    setBusy(true)
    setFailure(undefined)
    setSaved(false)
    try {
      const validation = validateDraft(root, mergeForValidation(namespace.base, draft))
      if (validation !== undefined) {
        setFailure(validation)
        return
      }
      if (jsonErrors.size > 0) {
        setFailure(t('invalidJson'))
        return
      }
      const ops = userOpsFor(namespace, draft, clearedSecrets)
      if (ops.length === 0) {
        setSaved(true)
        return
      }
      const outcome = write !== undefined
        ? await write(ops, namespace.revision)
        : await (async () => {
          const response = await mutateSettings({
            ns: namespace.ns,
            ops,
            expectedRevision: namespace.revision,
          })
          if (!response.result.ok) {
            return {
              conflict: response.result.error.code === 'settings-conflict',
              message: response.result.error.code === 'settings-conflict'
                ? t('conflict')
                : response.result.error.message,
            }
          }
          return undefined
        })()
      if (outcome !== undefined) {
        if (outcome.conflict) onChanged()
        setFailure(outcome.message)
        return
      }
      setSaved(true)
      onChanged()
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  if (schema.type === undefined) {
    return <p className={styles['error']}>{t('invalidSchema')}</p>
  }

  return (
    <article className={styles['card']}>
      <div className={styles['cardHeader']}>
        <h2 className={styles['cardTitle']}>{title ?? namespace.ns}</h2>
        {headerExtra}
        <span className={styles['applies']}>{namespace.applies === 'restart' ? t('restart') : t('live')}</span>
      </div>
      <Field
        node={schema}
        path={[]}
        namespace={namespace}
        draft={draft}
        disabled={disabled}
        t={t}
        onSet={setValue}
        onReset={resetValue}
        onJsonError={setJsonError}
        jsonErrors={jsonErrors}
      />
      {namespace.applies === 'restart' ? <p className={styles['notice']}>{t('restartNotice')}</p> : null}
      {!writable ? <p className={styles['notice']}>{t('readOnly')}</p> : null}
      {failure === undefined ? null : <p className={styles['error']}>{failure}</p>}
      {saved ? <p className={styles['saved']}>{t('saved')}</p> : null}
      <div className={styles['actions']}>
        <button type="button" className={styles['primaryButton']} disabled={disabled} onClick={() => { void apply() }}>
          {busy ? t('saving') : t('save')}
        </button>
      </div>
    </article>
  )
}

/**
 * One mounted plugin's composition configuration, edited through the same
 * schema editor as a settings namespace: the redacted resolved value is both
 * the display base and the editable draft, writes are path ops applied
 * host-side to the CURRENT resolved configuration (secrets survive), and the
 * whole-row reset removes the personal-overlay row so the next boot reverts
 * to the lower composition layers.
 */
function CompositionCard({
  row, writable, mutateSettings, updateComposition, removeComposition, t, onChanged, title,
}: {
  row: CompositionNamespaceView
  writable: boolean
  mutateSettings: PluginSettingsSectionInjected['mutateSettings']
  updateComposition: PluginSettingsSectionInjected['updateComposition']
  removeComposition: PluginSettingsSectionInjected['removeComposition']
  t: PluginSettingsSectionCommonProps['t']
  onChanged: () => void
  /** Stable heading resolved by the owning navigation entry. */
  title: string
}): ReactNode {
  const [removing, setRemoving] = useState(false)
  const [removeFailure, setRemoveFailure] = useState<string | undefined>(undefined)
  const view: SettingsNamespaceView = {
    ns: row.id,
    schema: row.schema,
    value: row.value,
    user: row.value,
    applies: 'restart',
    secrets: row.secrets,
    revision: 0,
  }
  const write: WriteFn = async (ops) => {
    const response = await updateComposition({ id: row.id, ops })
    if (!response.result.ok) return { conflict: false, message: response.result.error.message }
    return undefined
  }
  const remove = async (): Promise<void> => {
    setRemoving(true)
    setRemoveFailure(undefined)
    try {
      const response = await removeComposition({ id: row.id })
      if (!response.result.ok) {
        setRemoveFailure(response.result.error.message)
        return
      }
      onChanged()
    } catch (error) {
      setRemoveFailure(error instanceof Error ? error.message : String(error))
    } finally {
      setRemoving(false)
    }
  }
  const headerExtra = (
    <button
      type="button"
      className={styles['removeButton']}
      disabled={removing || !writable}
      onClick={() => { void remove() }}
    >
      {t('composition.remove')}
    </button>
  )
  return (
    <>
      <NamespaceEditor
        namespace={view}
        writable={writable}
        mutateSettings={mutateSettings}
        t={t}
        onChanged={onChanged}
        write={write}
        headerExtra={headerExtra}
        title={title}
      />
      {removeFailure === undefined ? null : <p className={styles['error']}>{removeFailure}</p>}
    </>
  )
}

/** Stable React identity for one descriptor snapshot; unchanged refreshes preserve drafts. */
function editorKey(value: SettingsNamespaceView | CompositionNamespaceView): string {
  return JSON.stringify(value)
}

/**
 * Render one registration-bound plugin editor in the settings detail column.
 * @param props - composed slot props plus the dynamic source key.
 * @returns the selected plugin editor, or null after its source disappears.
 */
export function PluginSettingsSection(props: PluginSettingsSectionProps): ReactNode {
  const {
    pluginKey, usePluginSettings, reload, mutateSettings,
    updateComposition, removeComposition, t,
  } = props
  const state = usePluginSettings(snapshot => snapshot)
  const entry = pluginSettingsEntry(state, pluginKey)
  if (entry === undefined) return null
  const onChanged = (): void => { void reload() }
  const refreshFailure = state.status === 'error' ? (
    <div className={styles['refreshFailure']} role="alert">
      <p className={styles['error']}>{`${t('status.loadFailed')}: ${state.error ?? ''}`}</p>
      <button type="button" className={styles['secondaryButton']} onClick={() => { void reload() }}>
        {t('status.retry')}
      </button>
    </div>
  ) : null
  return (
    <div className={styles['section']}>
      {refreshFailure}
      {entry.kind === 'settings' ? (
        <NamespaceEditor
          key={editorKey(entry.namespace)}
          namespace={entry.namespace}
          writable={state.writable}
          mutateSettings={mutateSettings}
          t={t}
          onChanged={onChanged}
        />
      ) : (
        <CompositionCard
          key={editorKey(entry.row)}
          row={entry.row}
          writable={state.writable}
          mutateSettings={mutateSettings}
          updateComposition={updateComposition}
          removeComposition={removeComposition}
          t={t}
          onChanged={onChanged}
          title={entry.label}
        />
      )}
    </div>
  )
}

/**
 * Create a component identity dedicated to one dynamic navigation entry.
 * `deferRegistration` uses component identity as its HMR presence probe, so
 * catalog entries must not share the generic editor function itself.
 * @param pluginKey - stable source key closed over by the component.
 * @returns a slot component bound to that key.
 */
export function createPluginSettingsSection(pluginKey: PluginSettingsEntryKey) {
  return function BoundPluginSettingsSection(props: PluginSettingsSectionCommonProps): ReactNode {
    return <PluginSettingsSection {...props} pluginKey={pluginKey} />
  }
}

/**
 * Render the temporary loading, empty, or initial-failure navigation item.
 * @param props - composed slot props.
 * @returns status copy, or null once real plugin entries exist.
 */
export function PluginSettingsStatusSection({
  usePluginSettings, reload, t,
}: PluginSettingsSectionCommonProps): ReactNode {
  const state = usePluginSettings(snapshot => snapshot)
  if (state.namespaces.length + state.composition.length > 0) return null
  if (state.status === 'error') {
    return (
      <div className={styles['section']}>
        <p className={styles['error']} role="alert">{`${t('status.loadFailed')}: ${state.error ?? ''}`}</p>
        <button type="button" className={styles['secondaryButton']} onClick={() => { void reload() }}>
          {t('status.retry')}
        </button>
      </div>
    )
  }
  return (
    <div className={styles['section']}>
      <p className={styles['notice']}>{state.status === 'ready' ? t('status.empty') : t('status.loading')}</p>
    </div>
  )
}
