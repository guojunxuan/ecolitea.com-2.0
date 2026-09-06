export type NavigationState = {
  activeItemIndex: number | null
  activeNavItemIndex: number | null
  level: 1 | 2 | 3
}

export type NavigationAction =
  | { type: 'openDropdown'; navItemIndex: number }
  | { type: 'openItem'; itemIndex: number }
  | { type: 'back' }
  | { type: 'reset' }

export const initialNavigationState: NavigationState = {
  activeItemIndex: null,
  activeNavItemIndex: null,
  level: 1,
}

export function navigationReducer(
  state: NavigationState,
  action: NavigationAction,
): NavigationState {
  switch (action.type) {
    case 'openDropdown':
      return {
        activeItemIndex: null,
        activeNavItemIndex: action.navItemIndex,
        level: 2,
      }
    case 'openItem':
      if (state.level !== 2 || state.activeNavItemIndex === null) return state
      return { ...state, activeItemIndex: action.itemIndex, level: 3 }
    case 'back':
      if (state.level === 3) return { ...state, activeItemIndex: null, level: 2 }
      if (state.level === 2) return initialNavigationState
      return state
    case 'reset':
      return initialNavigationState
  }
}
