// Чтение и запись прогресса в localStorage с версией схемы и миграцией

import type { RoundKind } from '../types';
import {
  createProgress,
  emptyGameProgress,
  DEFAULT_SETTINGS,
  FEEDBACK_DELAY_MAX,
  FEEDBACK_DELAY_MIN,
  type Progress,
  type Settings,
} from './progress';

export const STORAGE_KEY = 'hebrew-train/v2';
export const LEGACY_STORAGE_KEY = 'hebrew-train-stats';

interface LegacyScore {
  correct: number;
  total: number;
}

/** Переносит суммарные correct/total старых игр в новую схему */
export const migrateLegacy = (legacy: Record<string, unknown>): Progress => {
  const progress = createProgress();
  const mapping: Record<string, RoundKind> = {
    'letter-choice': 'letter-choice',
    'letter-input': 'letter-choice',
    'word-choice': 'word-choice',
    'word-input': 'word-input',
  };
  for (const [oldKey, kind] of Object.entries(mapping)) {
    const score = legacy[oldKey] as LegacyScore | undefined;
    if (!score || typeof score.correct !== 'number' || typeof score.total !== 'number') continue;
    const game = progress.games[kind] ?? emptyGameProgress();
    progress.games[kind] = {
      ...game,
      totalCorrect: game.totalCorrect + score.correct,
      totalAnswers: game.totalAnswers + score.total,
    };
  }
  return progress;
};

const normalizeSettings = (raw: Partial<Settings> | undefined): Settings => {
  const settings = { ...DEFAULT_SETTINGS, ...raw };
  // диапазон задержки менялся — подтягиваем старые значения в допустимые границы
  settings.feedbackDelay = Math.min(FEEDBACK_DELAY_MAX, Math.max(FEEDBACK_DELAY_MIN, Number(settings.feedbackDelay) || DEFAULT_SETTINGS.feedbackDelay));
  if (typeof settings.topic !== 'string') settings.topic = null;
  return settings;
};

/** Дополняет загруженные данные полями по умолчанию, чтобы старые копии не ломали приложение */
const normalize = (raw: Partial<Progress>): Progress => {
  const base = createProgress();
  return {
    ...base,
    ...raw,
    version: 2,
    words: raw.words ?? {},
    games: raw.games ?? {},
    days: raw.days ?? {},
    streak: { ...base.streak, ...raw.streak },
    settings: normalizeSettings(raw.settings),
  };
};

export const loadProgress = (storage: Storage = localStorage): Progress => {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) return normalize(JSON.parse(raw));

    const legacyRaw = storage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const migrated = migrateLegacy(JSON.parse(legacyRaw));
      saveProgress(migrated, storage);
      storage.removeItem(LEGACY_STORAGE_KEY);
      return migrated;
    }
  } catch (error) {
    console.warn('Не удалось прочитать прогресс:', error);
  }
  return createProgress();
};

export const saveProgress = (progress: Progress, storage: Storage = localStorage): void => {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (error) {
    console.warn('Не удалось сохранить прогресс:', error);
  }
};
