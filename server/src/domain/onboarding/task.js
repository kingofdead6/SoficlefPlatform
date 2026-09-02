/** Onboarding task state machine (ported from domain/onboarding/task.ts). */

const ALLOWED_NEXT = {
  TODO: ['IN_PROGRESS', 'BLOCKED', 'DONE'],
  IN_PROGRESS: ['TODO', 'BLOCKED', 'DONE'],
  BLOCKED: ['TODO', 'IN_PROGRESS', 'DONE'],
  DONE: ['TODO', 'IN_PROGRESS', 'BLOCKED', 'VALIDATED'],
  VALIDATED: ['DONE'],
};

export const COMPLETED_STATUSES = ['DONE', 'VALIDATED'];

export function isCompleted(status) {
  return COMPLETED_STATUSES.includes(status);
}

export function requiredActionFor(next) {
  return next === 'VALIDATED' ? 'validate' : 'update';
}

export function canTransition(from, to) {
  return ALLOWED_NEXT[from].includes(to);
}

export class InvalidTaskTransitionError extends Error {
  status = 409;
  constructor(from, to) {
    super(`Cannot move an onboarding task from ${from} to ${to}`);
    this.name = 'InvalidTaskTransitionError';
    this.from = from;
    this.to = to;
  }
}

export function assertTransition(from, to) {
  if (from === to) return;
  if (!canTransition(from, to)) throw new InvalidTaskTransitionError(from, to);
}

export function isOverdue(task, today = new Date()) {
  if (!task.dueDate || isCompleted(task.status)) return false;
  const day = (date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return day(task.dueDate) < day(today);
}

export function isDueSoon(task, days = 3, today = new Date()) {
  if (!task.dueDate || isCompleted(task.status) || isOverdue(task, today)) return false;
  const dayInMs = 24 * 60 * 60 * 1000;
  const day = (date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return (day(task.dueDate) - day(today)) / dayInMs <= days;
}

export function progressOf(tasks, today = new Date()) {
  const completed = tasks.filter((task) => isCompleted(task.status)).length;
  return {
    total: tasks.length,
    completed,
    validated: tasks.filter((task) => task.status === 'VALIDATED').length,
    blocked: tasks.filter((task) => task.status === 'BLOCKED').length,
    overdue: tasks.filter((task) => isOverdue(task, today)).length,
    percent: tasks.length === 0 ? 0 : Math.round((completed / tasks.length) * 100),
  };
}

export function dueDateFor(startDate, dayOffset) {
  const due = new Date(startDate);
  due.setDate(due.getDate() + dayOffset);
  return due;
}
