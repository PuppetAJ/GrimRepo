/** Single-key shortcuts act only while focus is in the table (WCAG 2.1.4), never elsewhere on the page. */
export const forTable = (event: KeyboardEvent) =>
  !event.metaKey &&
  !event.ctrlKey &&
  !event.altKey &&
  event.target instanceof Element &&
  event.target.closest('[data-table]') !== null
