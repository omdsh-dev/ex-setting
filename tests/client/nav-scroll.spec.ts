// @vitest-environment jsdom
/** Nav-scroll style injection: idempotent install, exact rules, and removal. */

import { afterEach, describe, expect, it } from 'vitest'
import { installNavScrollStyles, NAV_SCROLL_PATCH } from '../../src/client/nav-scroll.ts'

afterEach(() => {
  for (const element of document.querySelectorAll(`style[data-fabric="${NAV_SCROLL_PATCH}"]`)) {
    element.remove()
  }
})

describe('installNavScrollStyles', () => {
  it('injects the dialog navigation scroll rules once and idempotently', () => {
    const first = installNavScrollStyles()
    const second = installNavScrollStyles()
    const elements = document.querySelectorAll(`style[data-fabric="${NAV_SCROLL_PATCH}"]`)
    expect(elements).toHaveLength(1)
    expect(elements[0]?.textContent).toContain('[role="dialog"] [role="navigation"]')
    expect(elements[0]?.textContent).toContain('overflow-y: auto')
    first()
    second()
  })

  it('removes the styles with the disposer and re-installs on the next call', () => {
    const dispose = installNavScrollStyles()
    expect(document.querySelectorAll(`style[data-fabric="${NAV_SCROLL_PATCH}"]`)).toHaveLength(1)
    dispose()
    expect(document.querySelectorAll(`style[data-fabric="${NAV_SCROLL_PATCH}"]`)).toHaveLength(0)
    installNavScrollStyles()
    expect(document.querySelectorAll(`style[data-fabric="${NAV_SCROLL_PATCH}"]`)).toHaveLength(1)
  })
})
