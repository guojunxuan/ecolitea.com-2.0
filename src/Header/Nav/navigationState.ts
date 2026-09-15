export type NavigationState = {
  activeSectionId: string | null
  rootScrollTop: number
  sectionAccordion: Record<string, string | null>
  sectionScrollTop: Record<string, number>
}

export type NavigationAction =
  | { type: 'openSection'; sectionId: string }
  | { type: 'backToRoot'; sectionId: string; scrollTop: number }
  | { type: 'setRootScrollTop'; scrollTop: number }
  | { type: 'setSectionAccordion'; blockId: string; categoryId: string | null }
  | { type: 'setSectionScrollTop'; sectionId: string; scrollTop: number }
  | { type: 'reset' }

export const initialNavigationState: NavigationState = {
  activeSectionId: null,
  rootScrollTop: 0,
  sectionAccordion: {},
  sectionScrollTop: {},
}

export function navigationReducer(
  state: NavigationState,
  action: NavigationAction,
): NavigationState {
  switch (action.type) {
    case 'openSection':
      return { ...state, activeSectionId: action.sectionId }
    case 'backToRoot':
      return {
        ...state,
        activeSectionId: null,
        sectionScrollTop: {
          ...state.sectionScrollTop,
          [action.sectionId]: action.scrollTop,
        },
      }
    case 'setRootScrollTop':
      return { ...state, rootScrollTop: action.scrollTop }
    case 'setSectionAccordion':
      return {
        ...state,
        sectionAccordion: { ...state.sectionAccordion, [action.blockId]: action.categoryId },
      }
    case 'setSectionScrollTop':
      return {
        ...state,
        sectionScrollTop: { ...state.sectionScrollTop, [action.sectionId]: action.scrollTop },
      }
    case 'reset':
      return initialNavigationState
  }
}
