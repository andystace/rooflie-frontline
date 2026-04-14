export const JOB_STATUSES = [
  { value: 'pipeline', label: 'Pipeline', colour: '#3B82F6' },
  { value: 'confirmed', label: 'Confirmed', colour: '#10B981' },
  { value: 'in_progress', label: 'In Progress', colour: '#E8731A' },
  { value: 'complete', label: 'Complete', colour: '#6B7280' },
  { value: 'on_hold', label: 'On Hold', colour: '#EF4444' },
]

export const ENTRY_TYPES = [
  { value: 'job', label: 'Job', colour: null },
  { value: 'holiday', label: 'Holiday', colour: '#9CA3AF' },
  { value: 'sick', label: 'Sick', colour: '#E74C3C' },
  { value: 'rained_off', label: 'Rained Off', colour: '#95A5A6' },
  { value: 'office', label: 'Office Time', colour: '#3498DB' },
  { value: 'surveys', label: 'Surveys', colour: '#1ABC9C' },
  { value: 'unbilled', label: 'Unbilled', colour: '#7F8C8D' },
  { value: 'training', label: 'Training', colour: '#27AE60' },
]

export const COST_TYPES = [
  { value: 'materials', label: 'Materials' },
  { value: 'scaffold', label: 'Scaffold' },
  { value: 'skip', label: 'Skip' },
  { value: 'mewp', label: 'MEWP' },
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'travel', label: 'Travel' },
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'other', label: 'Other' },
]

export const TEAM_ROLES = [
  { value: 'roofer', label: 'Roofer' },
  { value: 'labourer', label: 'Labourer' },
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'apprentice', label: 'Apprentice' },
]

export const DEFAULT_HOURS_PER_DAY = 8

// Auto-assigned job colours for the schedule
export const JOB_COLOURS = [
  '#2563EB', '#DC2626', '#059669', '#D97706', '#7C3AED',
  '#DB2777', '#0891B2', '#65A30D', '#EA580C', '#4F46E5',
  '#0D9488', '#CA8A04', '#9333EA', '#E11D48', '#0284C7',
  '#16A34A', '#C2410C', '#6D28D9', '#BE185D', '#0E7490',
]
