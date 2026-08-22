// @vitest-environment jsdom
/** Nav-scroll style injection: idempotent install, exact rules, and removal. */

import { afterEach, describe, expect, it } from 'vitest'
import { installNavScrollStyles, NAV_SCROLL_STYLE_ID } from '../../src/client/nav-scroll.ts'

afterEach(() => {
  for (const element of document.querySelectorAll(`style[data-fabric="${NAV_SCROLL_STYLE_ID}"]`)) {
    element.remove()
  }
})

describe('installNavScrollStyles', () => {
  it('injects the dialog navigation scroll rules once and keeps them until all owners dispose', () => {
    const first = installNavScrollStyles()
    const second = installNavScrollStyles()
    const elements = document.querySelectorAll(`style[data-fabric="${NAV_SCROLL_STYLE_ID}"]`)
    expect(elements).toHaveLength(1)
    expect(elements[0]?.textContent).toContain('[role="dialog"] nav')
    expect(elements[0]?.textContent).toContain('overflow-y: auto')
    first()
    expect(document.querySelectorAll(`style[data-fabric="${NAV_SCROLL_STYLE_ID}"]`)).toHaveLength(1)
    second()
    expect(document.querySelectorAll(`style[data-fabric="${NAV_SCROLL_STYLE_ID}"]`)).toHaveLength(0)
  })

  it('removes the styles with the disposer and re-installs on the next call', () => {
    const dispose = installNavScrollStyles()
    expect(document.querySelectorAll(`style[data-fabric="${NAV_SCROLL_STYLE_ID}"]`)).toHaveLength(1)
    dispose()
    expect(document.querySelectorAll(`style[data-fabric="${NAV_SCROLL_STYLE_ID}"]`)).toHaveLength(0)
    installNavScrollStyles()
    expect(document.querySelectorAll(`style[data-fabric="${NAV_SCROLL_STYLE_ID}"]`)).toHaveLength(1)
  })
})
