/**
 * Calculate derived job metrics per the spec.
 * All inputs are the raw job row + schedule entries for that job.
 */
export function calcJobMetrics(job, scheduleEntries = [], variations = []) {
  const variationValue = variations.reduce((s, v) => s + Number(v.variation_value || 0), 0)
  const variationGp = variations.reduce((s, v) => s + Number(v.variation_gp || 0), 0)
  const variationHours = variations.reduce((s, v) => s + Number(v.additional_hours || 0), 0)

  const totalValue = Number(job.sold_value || 0) + variationValue
  const totalGp = Number(job.sold_gp || 0) + variationGp
  const totalHours = Number(job.hours_allowed || 0) + variationHours

  const twoManDays = totalHours / 16

  const hoursUsedCurrent = scheduleEntries
    .filter(e => e.job_id === job.id && e.entry_type === 'job')
    .reduce((s, e) => s + Number(e.hours || 0), 0)

  const hoursUsedPrevious = Number(job.hours_used_previous || 0)
  const hoursUsedTotal = hoursUsedPrevious + hoursUsedCurrent
  const hoursRemaining = totalHours - hoursUsedTotal

  const gpPerHour = totalHours > 0 ? totalGp / totalHours : 0

  const labourPercent = totalHours > 0 ? hoursUsedTotal / totalHours : 0

  const earnedRevenue = labourPercent * totalValue
  const invoiced = Number(job.invoiced_to_date || 0)
  const wipValue = earnedRevenue - invoiced

  const materialSpent = Number(job.material_spent || 0)
  const scaffoldCost = Number(job.scaffold_cost || 0)
  const otherCosts = Number(job.other_costs || 0)
  const totalCosts = materialSpent + scaffoldCost + otherCosts

  // Labour cost = hours used × average rate (approximation using day_rate/8)
  // For simplicity, we count scheduled hours × a flat rate
  const labourCost = hoursUsedTotal * (250 / 8) // default day rate / 8

  const actualGpToDate = earnedRevenue - (labourCost + totalCosts)

  return {
    totalValue,
    totalGp,
    totalHours,
    twoManDays,
    hoursUsedCurrent,
    hoursUsedPrevious,
    hoursUsedTotal,
    hoursRemaining,
    gpPerHour,
    labourPercent,
    earnedRevenue,
    wipValue,
    totalCosts,
    labourCost,
    actualGpToDate,
    variationValue,
    variationGp,
    variationHours,
  }
}

/**
 * Calculate GP earned for a single schedule entry.
 */
export function calcEntryGp(entry, job) {
  if (!job || entry.entry_type !== 'job') return 0
  const totalGp = Number(job.sold_gp || 0)
  const totalHours = Number(job.hours_allowed || 0)
  if (totalHours === 0) return 0
  const gpPerHour = totalGp / totalHours
  return Number(entry.hours || 0) * gpPerHour
}

/**
 * Calculate month forecast GP from schedule entries + jobs.
 */
export function calcMonthGpForecast(entries, jobs) {
  let total = 0
  for (const entry of entries) {
    if (entry.entry_type !== 'job' || !entry.job_id) continue
    const job = jobs.find(j => j.id === entry.job_id)
    if (!job) continue
    total += calcEntryGp(entry, job)
  }
  return total
}

/**
 * Utilisation % = productive hours / total available hours
 */
export function calcUtilisation(entries, teamCount, workingDays) {
  const totalAvailable = teamCount * workingDays * 8
  if (totalAvailable === 0) return 0
  const productive = entries
    .filter(e => e.entry_type === 'job')
    .reduce((s, e) => s + Number(e.hours || 0), 0)
  return productive / totalAvailable
}

/**
 * Format currency for display.
 */
export function formatCurrency(value) {
  if (value == null || isNaN(value)) return '—'
  return '£' + Number(value).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export function formatCurrencyDetailed(value) {
  if (value == null || isNaN(value)) return '—'
  return '£' + Number(value).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatPercent(value) {
  if (value == null || isNaN(value)) return '—'
  return (value * 100).toFixed(1) + '%'
}

/**
 * Month Turnover = proportional sold_value based on hours scheduled this month.
 * For each job: (hours_scheduled_this_month / hours_allowed) × sold_value
 */
export function calcMonthTurnover(monthEntries, jobs) {
  // Sum scheduled hours per job for the month
  const jobHoursMap = {}
  for (const e of monthEntries) {
    if (e.entry_type !== 'job' || !e.job_id) continue
    jobHoursMap[e.job_id] = (jobHoursMap[e.job_id] || 0) + Number(e.hours || 0)
  }
  let total = 0
  for (const [jobId, monthHours] of Object.entries(jobHoursMap)) {
    const job = jobs.find(j => j.id === jobId)
    if (!job) continue
    const hoursAllowed = Number(job.hours_allowed || 0)
    if (hoursAllowed === 0) continue
    total += (monthHours / hoursAllowed) * Number(job.sold_value || 0)
  }
  return total
}

/**
 * Build overrun map from ALL job-type schedule entries.
 * Returns { [jobId]: { hoursUsed, hoursAllowed, ratio } }
 */
export function calcJobOverrunMap(allJobEntries, jobs, allVariations = []) {
  const map = {}
  for (const e of allJobEntries) {
    if (e.entry_type !== 'job' || !e.job_id) continue
    if (!map[e.job_id]) map[e.job_id] = 0
    map[e.job_id] += Number(e.hours || 0)
  }
  // Sum variation hours per job
  const varHoursMap = {}
  for (const v of allVariations) {
    if (!v.job_id) continue
    if (!varHoursMap[v.job_id]) varHoursMap[v.job_id] = 0
    varHoursMap[v.job_id] += Number(v.additional_hours || 0)
  }
  const result = {}
  for (const job of jobs) {
    const scheduledHours = map[job.id] || 0
    const hoursUsed = scheduledHours + Number(job.hours_used_previous || 0)
    const hoursAllowed = Number(job.hours_allowed || 0) + (varHoursMap[job.id] || 0)
    const ratio = hoursAllowed > 0 ? hoursUsed / hoursAllowed : 0
    result[job.id] = { hoursUsed, hoursAllowed, ratio }
  }
  return result
}

/**
 * Returns 'ok' | 'warning' | 'overrun' based on ratio.
 */
export function getOverrunStatus(ratio) {
  if (ratio >= 1.0) return 'overrun'
  if (ratio >= 0.9) return 'warning'
  return 'ok'
}
