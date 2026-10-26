// Утилиты для работы с ивритским текстом

/**
 * Проверяет, является ли текст ивритом
 * @param text - текст для проверки
 * @returns true если текст содержит только ивритские символы и пробелы
 */
export const isHebrewText = (text: string): boolean => {
  if (!text) return true; // пустая строка считается валидной
  return /^[\u0590-\u05FF\s'’`]*$/.test(stripInvisible(text));
};

/**
 * Убирает невидимые символы, которые телефонные клавиатуры добавляют к ивритскому тексту:
 * метки направления (RLM, LRM, встраивания, изоляты), пробел нулевой ширины, BOM
 * @param text - текст
 * @returns текст без невидимых символов
 */
export const stripInvisible = (text: string): string => {
  return text.replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\u061C\uFEFF]/g, '');
};

/**
 * Убирает огласовки и знаки кантилляции (макеф, пасек и гереш остаются)
 * @param text - текст
 * @returns текст без огласовок
 */
export const stripNikud = (text: string): string => {
  return text.replace(/[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g, '');
};

/**
 * Приводит введённое слово к виду для сравнения: без невидимых символов и огласовок,
 * пробелы по краям обрезаны, несколько пробелов подряд (любых, включая неразрывный) — один
 * @param text - введённый текст
 * @returns очищенный текст
 */
export const cleanHebrewInput = (text: string): string => {
  return stripNikud(normalizeGeresh(stripInvisible(text))).replace(/\s+/g, ' ').trim();
};

/**
 * Заменяет апостроф, набранный с клавиатуры, на ивритский гереш (׳)
 * @param text - текст для нормализации
 * @returns текст с герешем вместо апострофа
 */
export const normalizeGeresh = (text: string): string => {
  return text.replace(/['’`]/g, '׳');
};

/**
 * Проверяет, является ли символ ивритской буквой (не пробел, не гереш, не огласовка)
 * @param char - символ
 * @returns true для букв א–ת, включая конечные формы
 */
export const isHebrewLetter = (char: string): boolean => {
  return /^[\u05D0-\u05EA]$/.test(char);
};

/**
 * Считает количество ивритских букв в слове (без пробелов и гереша)
 * @param word - слово
 * @returns число букв
 */
export const countHebrewLetters = (word: string): number => {
  return Array.from(word).filter(isHebrewLetter).length;
};

/**
 * Нормализует финальные формы ивритских букв
 * Преобразует финальные формы букв в обычные: ך → כ, ם → מ, ן → נ, ף → פ, ץ → צ
 * @param text - текст для нормализации
 * @returns нормализованный текст
 */
export const normalizeFinalLetters = (text: string): string => {
  return text
    .replace(/ך/g, 'כ')
    .replace(/ם/g, 'מ')
    .replace(/ן/g, 'נ')
    .replace(/ף/g, 'פ')
    .replace(/ץ/g, 'צ');
};

/**
 * Убирает удвоение י и ו: в иврите допускается и полное, и краткое написание (עגבנייה / עגבניה)
 * @param text - текст
 * @returns текст с одиночными י и ו
 */
export const collapseDoubleLetters = (text: string): string => {
  return text.replace(/יי/g, 'י').replace(/וו/g, 'ו');
};

/** Как ответ совпал с правильным словом: точно, другим допустимым написанием или не совпал */
export type SpellingMatch = 'exact' | 'variant' | 'none';

/**
 * Сравнивает ответ с правильным словом. Не учитывает финальные формы, огласовки,
 * лишние и невидимые пробелы, апостроф вместо гереша; удвоенные י и ו засчитывает как вариант написания
 * @param answer - ответ пользователя
 * @param target - правильное слово
 * @returns 'exact', 'variant' или 'none'
 */
export const matchHebrewSpelling = (answer: string, target: string): SpellingMatch => {
  const a = normalizeFinalLetters(cleanHebrewInput(answer));
  const t = normalizeFinalLetters(cleanHebrewInput(target));
  if (a === t) return 'exact';
  return collapseDoubleLetters(a) === collapseDoubleLetters(t) ? 'variant' : 'none';
};

/**
 * Сравнивает два ивритских слова (см. matchHebrewSpelling), варианты написания тоже считаются совпадением
 * @param word1 - первое слово
 * @param word2 - второе слово
 * @returns true если слова одинаковые
 */
export const compareHebrewWords = (word1: string, word2: string): boolean => {
  return matchHebrewSpelling(word1, word2) !== 'none';
};

/**
 * Получает визуально похожие ивритские буквы
 * @param letter - буква
 * @returns массив похожих букв
 */
export const getSimilarHebrewLetters = (letter: string): string[] => {
  const similarGroups: { [key: string]: string[] } = {
    'ד': ['ר', 'ה', 'ת'],
    'ר': ['ד', 'ה', 'ת'],
    'ב': ['כ', 'נ', 'מ'],
    'כ': ['ב', 'נ', 'מ'],
    'ה': ['ח', 'ת', 'ד'],
    'ח': ['ה', 'ת'],
    'ת': ['ה', 'ח', 'ד'],
    'ו': ['ז', 'י'],
    'ז': ['ו', 'י'],
    'י': ['ו', 'ז'],
    'ע': ['צ'],
    'צ': ['ע'],
    'ק': ['כ'],
    'ש': ['ת'],
    'מ': ['ם', 'ב', 'כ'],
    'נ': ['ן', 'ב'],
    'פ': ['ף', 'כ'],
  };

  const normalizedLetter = normalizeFinalLetters(letter);
  return similarGroups[normalizedLetter] || [];
};

/**
 * Получает все ивритские буквы
 * @returns массив всех букв алфавита
 */
export const getHebrewAlphabet = (): string[] => {
  return [
    'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י',
    'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר',
    'ש', 'ת'
  ];
};

/**
 * Получает случайную ивритскую букву
 * @param exclude - буквы, которые нужно исключить
 * @returns случайная буква
 */
export const getRandomHebrewLetter = (exclude: string[] = []): string => {
  const alphabet = getHebrewAlphabet().filter(
    letter => !exclude.includes(letter) && !exclude.includes(normalizeFinalLetters(letter))
  );
  return alphabet[Math.floor(Math.random() * alphabet.length)];
};

/**
 * Разбивает ивритское слово на массив букв
 * @param word - слово
 * @returns массив букв
 */
export const splitHebrewWord = (word: string): string[] => {
  return Array.from(word.trim());
};

/**
 * Проверяет, содержит ли слово букву
 * @param word - слово
 * @param letter - буква
 * @returns true если буква содержится в слове
 */
export const wordContainsLetter = (word: string, letter: string): boolean => {
  const normalizedWord = normalizeFinalLetters(word);
  const normalizedLetter = normalizeFinalLetters(letter);
  return normalizedWord.includes(normalizedLetter);
};

/**
 * Получает случайную позицию буквы в слове (пробелы и гереш не выбираются)
 * @param word - слово
 * @returns случайная позиция (индекс)
 */
export const getRandomPosition = (word: string): number => {
  const letterPositions = Array.from(word)
    .map((char, index) => (isHebrewLetter(char) ? index : -1))
    .filter(index => index >= 0);
  if (letterPositions.length === 0) return 0;
  return letterPositions[Math.floor(Math.random() * letterPositions.length)];
};

/**
 * Скрывает букву в указанной позиции
 * @param word - слово
 * @param position - позиция буквы
 * @returns объект с отображаемым словом и скрытой буквой
 */
export const hideLetterAtPosition = (word: string, position: number): { displayWord: string; hiddenLetter: string } => {
  const letters = splitHebrewWord(word);
  const hiddenLetter = letters[position];
  const displayWord = letters.map((letter, index) => 
    index === position ? '_' : letter
  ).join(' ');
  
  return { displayWord, hiddenLetter };
};

