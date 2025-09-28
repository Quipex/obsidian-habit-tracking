// meta/dv/relative-date-info.js

const locale = input?.locale ?? "ru";

if (!dv.luxon) {
  dv.paragraph("Ошибка: Библиотека Luxon не загружена.");
  return;
}

// Берём дату из названия файла (ожидается YYYY-MM-DD)
const noteDate = dv.luxon.DateTime.fromISO(dv.current().file.name);

if (!noteDate.isValid) {
  dv.paragraph("Ошибка: Название заметки не является корректной датой в формате YYYY-MM-DD.");
  return;
}

const today = dv.luxon.DateTime.now().startOf("day");

const rawWeekday = noteDate.setLocale(locale).toFormat("cccc");
const weekday = rawWeekday.charAt(0).toUpperCase() + rawWeekday.slice(1);

let relativeString;
if (today.hasSame(noteDate, "day")) {
  relativeString = "Сегодня 📅";
} else {
  const rel = noteDate.toRelative({ base: today, locale });
  relativeString = rel ? rel.charAt(0).toUpperCase() + rel.slice(1) : "";
}

dv.container.style.opacity = "0.8";
dv.paragraph(`**${relativeString}** · ${weekday}`);
