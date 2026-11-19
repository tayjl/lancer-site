import { inject, ref, type InjectionKey, type Ref } from 'vue'
import { isGm } from './auth'
import { restrictionReason, type Restriction } from './rules'

// A GM's edit mode (useMyPilot's gmEditing), provided by the pilot and mech pages to every picker under them, so
// Exotic content (rules.ts) can be chosen there and nowhere else.
export const GM_EDIT: InjectionKey<Ref<boolean>> = Symbol('gmEdit')

// Why a picker refuses something ("GM only", "GM edit only"), or '' when this viewer may pick it. Pass restrictionOf(thing).
export function useRestriction() {
  const gmEdit = inject(GM_EDIT, ref(false))
  return (r: Partial<Restriction>) => restrictionReason(r, { gm: isGm.value, gmEdit: gmEdit.value })
}
