// The role every task of a job graph carries: the worker's one generic handler,
// which runs whatever operator chain the plan gave that subtask
// (kGenericSubtaskRole in clink's job_planner.hpp). It names no operator, so it
// is shown as what it runs, and the topology card says which operators.
export const GENERIC_SUBTASK_ROLE = '__clink_subtask'

export const GENERIC_ROLE_HINT =
  "Runs an operator chain of the job's graph; the topology card shows which operators."

export function roleLabel(role: string): string {
  return role === GENERIC_SUBTASK_ROLE ? 'operator chain' : role
}

// The tooltip for a role cell: the hint for the generic role, nothing otherwise.
export function roleHint(role: string): string | undefined {
  return role === GENERIC_SUBTASK_ROLE ? GENERIC_ROLE_HINT : undefined
}
