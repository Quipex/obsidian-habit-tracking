export interface HabitMetaElements {
  card: HTMLDivElement;
  last: HTMLSpanElement;
  streak: HTMLSpanElement;
  button: HTMLButtonElement;
  timeLeft: HTMLSpanElement | null;
}

export function getHabitMetaElements(container: HTMLElement): HabitMetaElements {
  const card = container.querySelector<HTMLDivElement>(".dv-habit-card");
  if (!card) throw new Error("Habit card not found");

  const last = card.querySelector<HTMLSpanElement>(".dv-habit-meta .last");
  const streak = card.querySelector<HTMLSpanElement>(".dv-habit-meta .streak");
  const button = card.querySelector<HTMLButtonElement>(".dv-habit-iconbtn");

  if (!last || !streak || !button) {
    throw new Error("Habit meta elements missing");
  }

  const timeLeft = streak.querySelector<HTMLSpanElement>(".time-left");

  return { card, last, streak, button, timeLeft };
}
