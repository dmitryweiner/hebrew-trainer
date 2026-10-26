// Модель прогресса пользователя и чистые функции её изменения

import type { RoundKind } from '../types';
import { addDays, daysBetween, type Day } from './dates';

export type Box = 0 | 1 | 2 | 3 | 4 | 5;

/** Через сколько дней повторять слово из коробки */
export const BOX_INTERVALS: Record<Box, number> = { 0: 0, 1: 0, 2: 1, 3: 3, 4: 7, 5: 30 };

export const BOX_LABELS: Record<Box, string> = {
  0: 'Новое',
  1: 'Познакомился',
  2: 'Узнаю',
  3: 'Помню',
  4: 'Выучено',
  5: 'Закреплено',
};

export interface WordProgress {
  box: Box;
  due: Day;          // когда повторять
  seen: number;
  correct: number;
  wrong: number;
  lastSeen: Day;
}

export interface DayAnswers {
  d: Day;
  c: number;  // правильных
  t: number;  // всего
}

export interface GameProgress {
  rounds: number;
  bestCorrect: number;     // лучший раунд: правильных
  bestTotal: number;       // лучший раунд: всего (для «10/10»); для «Верно/Неверно» — рекорд очков
  lastStars: 0 | 1 | 2 | 3;
  totalCorrect: number;    // за всё время, включая перенесённую старую статистику
  totalAnswers: number;
  answers: DayAnswers[];   // по дням, не более 90 дней
}

export interface DayStats {
  rounds: number;
  correct: number;
  total: number;
  daily: boolean;          // была ли выполнена «Тренировка дня»
}

export interface Settings {
  fontScale: 1 | 1.15 | 1.3;
  sound: boolean;
  tts: boolean;
  typing: boolean;
  keyboard: 'screen' | 'system';   // клавиатура в «Напиши слово»
  autoNext: boolean;               // переходить к следующему заданию самому
  feedbackDelay: number;           // сколько секунд показывать ответ перед автопереходом
  topic: string | null;            // из какой темы брать новые слова, null — из всех
}

export const FEEDBACK_DELAY_MIN = 1;
export const FEEDBACK_DELAY_MAX = 4;

export interface Progress {
  version: 2;
  words: Record<string, WordProgress>;
  games: Partial<Record<RoundKind, GameProgress>>;
  days: Record<Day, DayStats>;
  streak: { current: number; best: number; lastDay: Day | null };
  settings: Settings;
}

export interface WordResult {
  wordId: string;
  correct: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  fontScale: 1,
  sound: true,
  tts: true,
  typing: true,
  keyboard: 'system',
  autoNext: true,
  feedbackDelay: 1,
  topic: null,
};

export const createProgress = (): Progress => ({
  version: 2,
  words: {},
  games: {},
  days: {},
  streak: { current: 0, best: 0, lastDay: null },
  settings: { ...DEFAULT_SETTINGS },
});

export const emptyGameProgress = (): GameProgress => ({
  rounds: 0,
  bestCorrect: 0,
  bestTotal: 0,
  lastStars: 0,
  totalCorrect: 0,
  totalAnswers: 0,
  answers: [],
});

export const getWordProgress = (progress: Progress, wordId: string): WordProgress | undefined =>
  progress.words[wordId];

export const getBox = (progress: Progress, wordId: string): Box => progress.words[wordId]?.box ?? 0;

export const isDue = (wp: WordProgress | undefined, today: Day): boolean =>
  !!wp && wp.box > 0 && wp.due <= today;

/**
 * Обновляет коробку слова после ответа.
 * - новое слово при любом ответе попадает в коробку 1;
 * - правильный ответ поднимает на коробку выше, только если подошёл срок повторения
 *   (повторять заранее не вредно, но и не ускоряет «выучивание»);
 * - ошибка опускает на одну коробку (не ниже 1) и делает слово срочным.
 */
export const applyWordAnswer = (wp: WordProgress | undefined, correct: boolean, today: Day): WordProgress => {
  const prev: WordProgress = wp ?? { box: 0, due: today, seen: 0, correct: 0, wrong: 0, lastSeen: today };
  const next: WordProgress = {
    ...prev,
    seen: prev.seen + 1,
    correct: prev.correct + (correct ? 1 : 0),
    wrong: prev.wrong + (correct ? 0 : 1),
    lastSeen: today,
  };

  if (!correct) {
    next.box = Math.max(1, prev.box - 1) as Box;
    next.due = today;
  } else if (prev.box === 0) {
    next.box = 1;
    next.due = today;
  } else if (prev.due <= today) {
    next.box = Math.min(5, prev.box + 1) as Box;
    next.due = addDays(today, BOX_INTERVALS[next.box]);
  }
  return next;
};

const MAX_ANSWER_DAYS = 90;

const addDayAnswer = (answers: DayAnswers[], today: Day, correct: boolean): DayAnswers[] => {
  const last = answers[answers.length - 1];
  const updated = last?.d === today
    ? [...answers.slice(0, -1), { d: today, c: last.c + (correct ? 1 : 0), t: last.t + 1 }]
    : [...answers, { d: today, c: correct ? 1 : 0, t: 1 }];
  return updated.filter(a => daysBetween(a.d, today) < MAX_ANSWER_DAYS);
};

const emptyDay = (): DayStats => ({ rounds: 0, correct: 0, total: 0, daily: false });

/**
 * Учитывает ответ на задание.
 * @param moveBox - менять ли коробку слова (в одном раунде коробка меняется только при первом показе слова)
 */
export const recordAnswer = (
  progress: Progress,
  kind: RoundKind,
  result: WordResult,
  today: Day,
  moveBox: boolean
): Progress => {
  const game = progress.games[kind] ?? emptyGameProgress();
  const day = progress.days[today] ?? emptyDay();
  const wp = progress.words[result.wordId];

  return {
    ...progress,
    words: moveBox
      ? { ...progress.words, [result.wordId]: applyWordAnswer(wp, result.correct, today) }
      : progress.words,
    games: {
      ...progress.games,
      [kind]: {
        ...game,
        totalCorrect: game.totalCorrect + (result.correct ? 1 : 0),
        totalAnswers: game.totalAnswers + 1,
        answers: addDayAnswer(game.answers, today, result.correct),
      },
    },
    days: {
      ...progress.days,
      [today]: { ...day, correct: day.correct + (result.correct ? 1 : 0), total: day.total + 1 },
    },
  };
};

/** Звёзды за раунд: 3 — без ошибок, 2 — от 80 %, 1 — остальное */
export const calcStars = (correct: number, total: number): 1 | 2 | 3 => {
  if (total > 0 && correct === total) return 3;
  if (total > 0 && correct / total >= 0.8) return 2;
  return 1;
};

export const updateStreak = (streak: Progress['streak'], today: Day): Progress['streak'] => {
  if (streak.lastDay === today) return streak;
  const current = streak.lastDay && daysBetween(streak.lastDay, today) === 1 ? streak.current + 1 : 1;
  return { current, best: Math.max(streak.best, current), lastDay: today };
};

/** Серия, которую стоит показывать сегодня: если вчера не занимались, серия прервалась */
export const visibleStreak = (streak: Progress['streak'], today: Day): number => {
  if (!streak.lastDay) return 0;
  return daysBetween(streak.lastDay, today) <= 1 ? streak.current : 0;
};

/**
 * Учитывает завершённый раунд.
 * @param score - для «Верно/Неверно» это набранные очки, для остальных — правильные ответы
 */
export const recordRound = (
  progress: Progress,
  kind: RoundKind,
  correct: number,
  total: number,
  today: Day
): Progress => {
  const game = progress.games[kind] ?? emptyGameProgress();
  const day = progress.days[today] ?? emptyDay();
  const isBetter = kind === 'speed'
    ? correct > game.bestTotal
    : total > 0 && (game.bestTotal === 0 || correct / total > game.bestCorrect / game.bestTotal ||
        (correct / total === game.bestCorrect / game.bestTotal && total > game.bestTotal));
  const best = isBetter
    ? kind === 'speed'
      ? { bestCorrect: correct, bestTotal: correct }
      : { bestCorrect: correct, bestTotal: total }
    : { bestCorrect: game.bestCorrect, bestTotal: game.bestTotal };

  return {
    ...progress,
    games: {
      ...progress.games,
      [kind]: { ...game, ...best, rounds: game.rounds + 1, lastStars: calcStars(correct, total) },
    },
    days: {
      ...progress.days,
      [today]: { ...day, rounds: day.rounds + 1, daily: day.daily || kind === 'daily' },
    },
    streak: updateStreak(progress.streak, today),
  };
};

/** Точность за последние N дней (в процентах) или null, если ответов не было */
export const recentAccuracy = (game: GameProgress | undefined, today: Day, days = 7): number | null => {
  if (!game) return null;
  const recent = game.answers.filter(a => daysBetween(a.d, today) < days);
  const total = recent.reduce((s, a) => s + a.t, 0);
  if (total === 0) return null;
  return Math.round((recent.reduce((s, a) => s + a.c, 0) / total) * 100);
};

export interface VocabularySummary {
  learned: number;   // коробки 4–5
  learning: number;  // коробки 1–3
  fresh: number;     // коробка 0
  due: number;       // к повторению сегодня
}

export const summarizeVocabulary = (progress: Progress, wordIds: string[], today: Day): VocabularySummary => {
  const summary: VocabularySummary = { learned: 0, learning: 0, fresh: 0, due: 0 };
  for (const id of wordIds) {
    const wp = progress.words[id];
    const box = wp?.box ?? 0;
    if (box >= 4) summary.learned++;
    else if (box >= 1) summary.learning++;
    else summary.fresh++;
    if (isDue(wp, today)) summary.due++;
  }
  return summary;
};
