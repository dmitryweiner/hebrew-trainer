import { describe, it, expect, beforeEach } from 'vitest';
import { loadProgress, saveProgress, STORAGE_KEY, LEGACY_STORAGE_KEY } from '../storage';
import { createProgress } from '../progress';

describe('storage', () => {
  beforeEach(() => localStorage.clear());

  it('без данных возвращает пустой прогресс', () => {
    expect(loadProgress()).toEqual(createProgress());
  });

  it('сохраняет и загружает прогресс', () => {
    const p = createProgress();
    p.streak.current = 3;
    saveProgress(p);
    expect(loadProgress().streak.current).toBe(3);
  });

  it('переносит старую статистику и удаляет старый ключ', () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({
      'letter-choice': { correct: 5, total: 8, percentage: 63 },
      'letter-input': { correct: 1, total: 2, percentage: 50 },
      'word-input': { correct: 3, total: 3, percentage: 100 },
      lastSession: '2025-11-01',
    }));
    const p = loadProgress();
    expect(p.games['letter-choice']).toMatchObject({ totalCorrect: 6, totalAnswers: 10 });
    expect(p.games['word-input']).toMatchObject({ totalCorrect: 3, totalAnswers: 3 });
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('дополняет неполные данные значениями по умолчанию', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, words: { a: { box: 2 } } }));
    const p = loadProgress();
    expect(p.settings.sound).toBe(true);
    expect(p.settings.topic).toBeNull();
    expect(p.words.a.box).toBe(2);
    expect(p.days).toEqual({});
  });

  it('повреждённые данные не ломают запуск', () => {
    localStorage.setItem(STORAGE_KEY, '{oops');
    expect(loadProgress()).toEqual(createProgress());
  });
});
