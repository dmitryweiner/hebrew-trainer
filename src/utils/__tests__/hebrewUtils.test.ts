// Тесты для hebrewUtils

import { describe, it, expect } from 'vitest';
import {
  isHebrewText,
  normalizeFinalLetters,
  compareHebrewWords,
  cleanHebrewInput,
  matchHebrewSpelling,
  getSimilarHebrewLetters,
  getHebrewAlphabet,
  getRandomHebrewLetter,
  splitHebrewWord,
  wordContainsLetter,
  normalizeGeresh,
  isHebrewLetter,
  countHebrewLetters,
  getRandomPosition,
} from '../hebrewUtils';

describe('hebrewUtils', () => {
  describe('isHebrewText', () => {
    it('должен возвращать true для ивритского текста', () => {
      expect(isHebrewText('שלום')).toBe(true);
      expect(isHebrewText('תפוח')).toBe(true);
      expect(isHebrewText('כלב חתול')).toBe(true);
    });

    it('должен возвращать true для пустой строки', () => {
      expect(isHebrewText('')).toBe(true);
    });

    it('должен возвращать false для не-ивритского текста', () => {
      expect(isHebrewText('hello')).toBe(false);
      expect(isHebrewText('привет')).toBe(false);
      expect(isHebrewText('123')).toBe(false);
      expect(isHebrewText('hello שלום')).toBe(false);
    });

    it('должен корректно обрабатывать пробелы', () => {
      expect(isHebrewText('שלום עולם')).toBe(true);
      expect(isHebrewText('   ')).toBe(true);
    });
  });

  describe('normalizeFinalLetters', () => {
    it('должен заменять финальные формы букв', () => {
      expect(normalizeFinalLetters('מפתך')).toBe('מפתכ'); // ך → כ
      expect(normalizeFinalLetters('לחם')).toBe('לחמ'); // ם → מ
      expect(normalizeFinalLetters('דלת')).toBe('דלת'); // нет финальных форм
    });

    it('должен обрабатывать все финальные формы', () => {
      expect(normalizeFinalLetters('ך')).toBe('כ');
      expect(normalizeFinalLetters('ם')).toBe('מ');
      expect(normalizeFinalLetters('ן')).toBe('נ');
      expect(normalizeFinalLetters('ף')).toBe('פ');
      expect(normalizeFinalLetters('ץ')).toBe('צ');
    });

    it('должен возвращать неизменённый текст, если финальных форм нет', () => {
      expect(normalizeFinalLetters('תפוח')).toBe('תפוח');
      expect(normalizeFinalLetters('כלב')).toBe('כלב');
    });
  });

  describe('compareHebrewWords', () => {
    it('должен возвращать true для одинаковых слов', () => {
      expect(compareHebrewWords('שלום', 'שלום')).toBe(true);
      expect(compareHebrewWords('תפוח', 'תפוח')).toBe(true);
    });

    it('должен игнорировать финальные формы', () => {
      expect(compareHebrewWords('מפתח', 'מפתח')).toBe(true); // С финальной ח
    });

    it('должен игнорировать пробелы', () => {
      expect(compareHebrewWords('  שלום  ', 'שלום')).toBe(true);
      expect(compareHebrewWords('שלום', '  שלום  ')).toBe(true);
    });

    it('должен возвращать false для разных слов', () => {
      expect(compareHebrewWords('שלום', 'תודה')).toBe(false);
      expect(compareHebrewWords('כלב', 'חתול')).toBe(false);
    });
  });

  describe('getSimilarHebrewLetters', () => {
    it('должен возвращать похожие буквы для ד', () => {
      const similar = getSimilarHebrewLetters('ד');
      expect(similar).toContain('ר');
      expect(similar.length).toBeGreaterThan(0);
    });

    it('должен возвращать похожие буквы для ב', () => {
      const similar = getSimilarHebrewLetters('ב');
      expect(similar).toContain('כ');
      expect(similar.length).toBeGreaterThan(0);
    });

    it('должен возвращать пустой массив для букв без похожих', () => {
      const similar = getSimilarHebrewLetters('א');
      expect(similar).toEqual([]);
    });

    it('должен нормализовать финальные формы', () => {
      const similar = getSimilarHebrewLetters('ך'); // Финальная форма כ
      expect(Array.isArray(similar)).toBe(true);
    });
  });

  describe('getHebrewAlphabet', () => {
    it('должен возвращать массив ивритских букв', () => {
      const alphabet = getHebrewAlphabet();
      expect(Array.isArray(alphabet)).toBe(true);
      expect(alphabet.length).toBe(22); // 22 буквы в иврите
    });

    it('должен содержать основные буквы', () => {
      const alphabet = getHebrewAlphabet();
      expect(alphabet).toContain('א');
      expect(alphabet).toContain('ב');
      expect(alphabet).toContain('ת');
    });

    it('не должен содержать финальные формы', () => {
      const alphabet = getHebrewAlphabet();
      expect(alphabet).not.toContain('ך');
      expect(alphabet).not.toContain('ם');
      expect(alphabet).not.toContain('ן');
      expect(alphabet).not.toContain('ף');
      expect(alphabet).not.toContain('ץ');
    });
  });

  describe('getRandomHebrewLetter', () => {
    it('должен возвращать букву из алфавита', () => {
      const letter = getRandomHebrewLetter();
      const alphabet = getHebrewAlphabet();
      expect(alphabet).toContain(letter);
    });

    it('не должен возвращать исключённые буквы', () => {
      const exclude = ['א', 'ב', 'ג'];
      const letter = getRandomHebrewLetter(exclude);
      expect(exclude).not.toContain(letter);
    });

    it('должен возвращать разные буквы при нескольких вызовах', () => {
      const letters = new Set();
      for (let i = 0; i < 10; i++) {
        letters.add(getRandomHebrewLetter());
      }
      expect(letters.size).toBeGreaterThan(1); // Должно быть несколько разных букв
    });
  });

  describe('splitHebrewWord', () => {
    it('должен разбивать слово на буквы', () => {
      expect(splitHebrewWord('שלום')).toEqual(['ש', 'ל', 'ו', 'ם']);
      expect(splitHebrewWord('תפוח')).toEqual(['ת', 'פ', 'ו', 'ח']);
    });

    it('должен обрабатывать пробелы', () => {
      expect(splitHebrewWord('  שלום  ')).toEqual(['ש', 'ל', 'ו', 'ם']);
    });

    it('должен возвращать пустой массив для пустой строки', () => {
      expect(splitHebrewWord('')).toEqual([]);
      expect(splitHebrewWord('   ')).toEqual([]);
    });

    it('должен корректно обрабатывать одну букву', () => {
      expect(splitHebrewWord('א')).toEqual(['א']);
    });
  });

  describe('wordContainsLetter', () => {
    it('должен находить букву в слове', () => {
      expect(wordContainsLetter('שלום', 'ש')).toBe(true);
      expect(wordContainsLetter('תפוח', 'פ')).toBe(true);
    });

    it('не должен находить отсутствующую букву', () => {
      expect(wordContainsLetter('שלום', 'א')).toBe(false);
      expect(wordContainsLetter('תפוח', 'כ')).toBe(false);
    });

    it('должен учитывать финальные формы', () => {
      expect(wordContainsLetter('מפתך', 'כ')).toBe(true); // ך → כ после нормализации
      expect(wordContainsLetter('שלום', 'מ')).toBe(true); // ם → מ
    });

    it('должен корректно работать с пустым словом', () => {
      expect(wordContainsLetter('', 'א')).toBe(false);
    });
  });

  describe('гереш и пробелы', () => {
    it('normalizeGeresh заменяет апостроф на гереш', () => {
      expect(normalizeGeresh("ג'ירפה")).toBe('ג׳ירפה');
      expect(normalizeGeresh('ז’קט')).toBe('ז׳קט');
    });

    it('isHebrewText принимает апостроф', () => {
      expect(isHebrewText("ג'ירפה")).toBe(true);
    });

    it('compareHebrewWords не различает апостроф и гереш', () => {
      expect(compareHebrewWords("ג'ירפה", 'ג׳ירפה')).toBe(true);
    });

    it('cleanHebrewInput убирает невидимые символы, огласовки и лишние пробелы', () => {
      expect(cleanHebrewInput('\u200Fשלום\u200E ')).toBe('שלום');
      expect(cleanHebrewInput('\u00A0שלום\u200B')).toBe('שלום');
      expect(cleanHebrewInput('  בית   ספר ')).toBe('בית ספר');
      expect(cleanHebrewInput('תַּפּוּחַ')).toBe('תפוח');
    });

    it('isHebrewText не ругается на невидимые метки направления', () => {
      expect(isHebrewText('\u200Fשלום\u200F')).toBe(true);
    });

    it('compareHebrewWords принимает ответ с невидимыми и неразрывными пробелами', () => {
      expect(compareHebrewWords('\u202Bשלום\u202C\u00A0', 'שלום')).toBe(true);
      expect(compareHebrewWords('בית  ספר', 'בית ספר')).toBe(true);
    });
  });

  describe('matchHebrewSpelling', () => {
    it('точное совпадение', () => {
      expect(matchHebrewSpelling(' עגבנייה ', 'עגבנייה')).toBe('exact');
    });

    it('краткое написание без удвоенных י и ו — вариант', () => {
      expect(matchHebrewSpelling('עגבניה', 'עגבנייה')).toBe('variant');
      expect(matchHebrewSpelling('ברוז', 'ברווז')).toBe('variant');
      expect(matchHebrewSpelling('עגבנייה', 'עגבניה')).toBe('variant');
      expect(compareHebrewWords('עגבניה', 'עגבנייה')).toBe(true);
    });

    it('другое слово не засчитывается', () => {
      expect(matchHebrewSpelling('עגבנה', 'עגבנייה')).toBe('none');
      expect(matchHebrewSpelling('', 'עגבנייה')).toBe('none');
    });

    it('isHebrewLetter отличает буквы от пробела и гереша', () => {
      expect(isHebrewLetter('א')).toBe(true);
      expect(isHebrewLetter('ם')).toBe(true);
      expect(isHebrewLetter(' ')).toBe(false);
      expect(isHebrewLetter('׳')).toBe(false);
    });

    it('countHebrewLetters не считает пробел и гереш', () => {
      expect(countHebrewLetters('תפוח אדמה')).toBe(8);
      expect(countHebrewLetters('ג׳ירפה')).toBe(5);
    });

    it('getRandomPosition никогда не выбирает пробел или гереш', () => {
      for (let i = 0; i < 200; i++) {
        expect(isHebrewLetter(Array.from('תפוח אדמה')[getRandomPosition('תפוח אדמה')])).toBe(true);
        expect(isHebrewLetter(Array.from('ג׳ירפה')[getRandomPosition('ג׳ירפה')])).toBe(true);
      }
    });
  });
});
