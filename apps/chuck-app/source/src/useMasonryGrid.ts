import { type RefObject, useLayoutEffect } from 'react'

const CARD_GAP = 18

export function useMasonryGrid(
  gridRef: RefObject<HTMLDivElement | null>,
  layoutKey: string,
) {
  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return

    const wrappers = Array.from(grid.children).filter(
      (element): element is HTMLElement => element instanceof HTMLElement,
    )

    const sizeWrapper = (wrapper: HTMLElement) => {
      const card = wrapper.querySelector<HTMLElement>('.card')
      if (!card) return
      // offsetHeight is layout-based, so GSAP transforms on the card or wrapper
      // cannot shrink the span while an entrance/hover animation is running.
      wrapper.style.gridRowEnd = `span ${Math.ceil(card.offsetHeight + CARD_GAP)}`
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const wrapper = entry.target.closest<HTMLElement>('.card-wrap')
        if (wrapper) sizeWrapper(wrapper)
      }
    })

    for (const wrapper of wrappers) {
      const card = wrapper.querySelector<HTMLElement>('.card')
      if (!card) continue
      observer.observe(card)
      sizeWrapper(wrapper)
    }

    // Fonts can settle after the first layout pass without producing a useful
    // measurement in older Safari releases.
    const frame = window.requestAnimationFrame(() => {
      for (const wrapper of wrappers) sizeWrapper(wrapper)
    })

    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [gridRef, layoutKey])
}
