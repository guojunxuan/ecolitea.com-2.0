export type NavigationState = {
  activeSectionId: string | null
  sectionAccordion: Record<string, string | null>
}

export type NavigationAction =
  | { type: 'toggleSection'; sectionId: string }
  | { type: 'setSectionAccordion'; blockId: string; categoryId: string | null }
  | { type: 'reset' }

export const initialNavigationState: NavigationState = {
  activeSectionId: null,
  sectionAccordion: {},
}

export function navigationReducer(
  state: NavigationState,
  action: NavigationAction,
): NavigationState {
  switch (action.type) {
    case 'toggleSection':
      return state.activeSectionId === action.sectionId
        ? initialNavigationState
        : { activeSectionId: action.sectionId, sectionAccordion: {} }
    case 'setSectionAccordion':
      return {
        ...state,
        sectionAccordion: { ...state.sectionAccordion, [action.blockId]: action.categoryId },
      }
    case 'reset':
      return initialNavigationState
  }
}
