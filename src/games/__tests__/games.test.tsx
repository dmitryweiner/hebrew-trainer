import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { WORD_BY_ID } from '../../data/dictionary';
import { createProgress, DEFAULT_SETTINGS } from '../../core/progress';
import WordChoiceTask from '../WordChoiceTask';
import LetterChoiceTask from '../LetterChoiceTask';
import WordInputTask from '../WordInputTask';
import AnagramTask from '../AnagramTask';
import MatchingTask from '../MatchingTask';
import MemoryTask from '../MemoryTask';
import FlashcardTask from '../FlashcardTask';
import SpeedTask, { SPEED_DURATION } from '../SpeedTask';
import ListenTask from '../ListenTask';
import { progressWithBox, renderTask } from './helpers';

const AUTO_NEXT_DELAY = DEFAULT_SETTINGS.feedbackDelay * 1000;

const he = (id: string) => WORD_BY_ID[id].hebrew;

beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

describe('Угадай слово', () => {
  it('правильный ответ: «Правильно!» и автопереход', () => {
    vi.useFakeTimers();
    const { onDone } = renderTask(WordChoiceTask, 'word-choice', ['dog']);
    fireEvent.click(screen.getByRole('button', { name: he('dog') }));
    expect(screen.getByText('✓ Правильно!')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(AUTO_NEXT_DELAY));
    expect(onDone).toHaveBeenCalledWith([{ wordId: 'dog', correct: true }]);
  });

  it('ошибка: варианты блокируются, переход только по «Дальше»', () => {
    vi.useFakeTimers();
    const { onDone } = renderTask(WordChoiceTask, 'word-choice', ['dog']);
    const wrong = screen.getAllByRole('button').find(b => b.textContent !== he('dog'))!;
    fireEvent.click(wrong);
    expect(screen.getByText('✗ Неправильно')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: he('dog') })[0]).toBeDisabled();
    act(() => vi.advanceTimersByTime(10_000));
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Дальше →' }));
    expect(onDone).toHaveBeenCalledWith([{ wordId: 'dog', correct: false }]);
  });

  it('пока звучит слово, карточка ответа не закрывается', () => {
    vi.useFakeTimers();
    const utterances: { onend: (() => void) | null }[] = [];
    vi.stubGlobal('SpeechSynthesisUtterance', class { onend = null; onerror = null; constructor() { utterances.push(this); } });
    vi.stubGlobal('speechSynthesis', {
      getVoices: () => [{ lang: 'he-IL' }],
      cancel: () => undefined,
      speak: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    });
    try {
      const { onDone } = renderTask(WordChoiceTask, 'word-choice', ['dog']);
      fireEvent.click(screen.getByRole('button', { name: he('dog') }));
      fireEvent.click(screen.getByRole('button', { name: '🔊' }));
      act(() => vi.advanceTimersByTime(10_000));
      expect(onDone).not.toHaveBeenCalled();
      act(() => utterances.at(-1)!.onend!());
      act(() => vi.advanceTimersByTime(AUTO_NEXT_DELAY));
      expect(onDone).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('без автоперехода ждёт «Дальше», переход засчитывается один раз', () => {
    vi.useFakeTimers();
    const progress = createProgress();
    progress.settings = { ...progress.settings, autoNext: false };
    const { onDone } = renderTask(WordChoiceTask, 'word-choice', ['dog'], progress);
    fireEvent.click(screen.getByRole('button', { name: he('dog') }));
    act(() => vi.advanceTimersByTime(10_000));
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Дальше →' }));
    fireEvent.click(screen.getByRole('button', { name: 'Дальше →' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('задержка автоперехода берётся из настроек', () => {
    vi.useFakeTimers();
    const progress = createProgress();
    progress.settings = { ...progress.settings, feedbackDelay: 3 };
    const { onDone } = renderTask(WordChoiceTask, 'word-choice', ['dog'], progress);
    fireEvent.click(screen.getByRole('button', { name: he('dog') }));
    act(() => vi.advanceTimersByTime(2900));
    expect(onDone).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(100));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('Угадай букву', () => {
  const missingLetter = (container: HTMLElement, word: string) => {
    const spans = [...container.querySelectorAll('.gapped-word > span')];
    return Array.from(word)[spans.findIndex(s => s.classList.contains('gap'))];
  };

  it('правильная буква засчитывается', () => {
    const { container, onDone } = renderTask(LetterChoiceTask, 'letter-choice', ['potato']);
    const letter = missingLetter(container, he('potato'));
    expect(letter).not.toBe(' ');
    fireEvent.click(screen.getByRole('button', { name: letter }));
    fireEvent.click(screen.getByRole('button', { name: 'Дальше →' }));
    expect(onDone).toHaveBeenCalledWith([{ wordId: 'potato', correct: true }]);
  });

  it('неправильная буква показывает слово целиком', () => {
    const { container, onDone } = renderTask(LetterChoiceTask, 'letter-choice', ['cat']);
    const letter = missingLetter(container, he('cat'));
    const wrong = [...container.querySelectorAll('.option-btn')].find(b => b.textContent !== letter)!;
    fireEvent.click(wrong);
    expect(container.querySelector('.gap')?.textContent).toBe(letter);
    fireEvent.click(screen.getByRole('button', { name: 'Дальше →' }));
    expect(onDone).toHaveBeenCalledWith([{ wordId: 'cat', correct: false }]);
  });
});

describe('Напиши слово', () => {
  const type = (value: string) => {
    fireEvent.change(screen.getByRole('textbox'), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Проверить' }));
  };

  it('с первой попытки — правильно; апостроф вместо гереша принимается', () => {
    const { onDone } = renderTask(WordInputTask, 'word-input', ['giraffe']);
    type("ג'ירפה");
    fireEvent.click(screen.getByRole('button', { name: 'Дальше →' }));
    expect(onDone).toHaveBeenCalledWith([{ wordId: 'giraffe', correct: true }]);
  });

  it('со второй попытки слово засчитывается, после первой ошибки — подсказка', () => {
    const { onDone } = renderTask(WordInputTask, 'word-input', ['dog']);
    type('חתול');
    expect(screen.getByText(/Первая буква/)).toBeInTheDocument();
    type(he('dog'));
    expect(screen.getByText('✓ Верно, но не с первой попытки').closest('.answer-feedback')).toHaveClass('is-correct');
    fireEvent.click(screen.getByRole('button', { name: 'Дальше →' }));
    expect(onDone).toHaveBeenCalledWith([{ wordId: 'dog', correct: true }]);
  });

  it('пробелы и невидимые символы по краям не мешают', () => {
    const { onDone } = renderTask(WordInputTask, 'word-input', ['dog']);
    type(` \u200F${he('dog')}\u00A0 `);
    expect(screen.getByText('✓ Правильно!')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Дальше →' }));
    expect(onDone).toHaveBeenCalledWith([{ wordId: 'dog', correct: true }]);
  });

  it('краткое написание засчитывается и показывает полную форму', () => {
    const { onDone } = renderTask(WordInputTask, 'word-input', ['tomato']);
    type('עגבניה');
    const feedback = screen.getByText('✓ Верно! Обычно пишут так:').closest('.answer-feedback');
    expect(feedback).toHaveClass('is-correct');
    expect(feedback).toHaveTextContent(he('tomato'));
    fireEvent.click(screen.getByRole('button', { name: 'Дальше →' }));
    expect(onDone).toHaveBeenCalledWith([{ wordId: 'tomato', correct: true }]);
  });

  it('экранная клавиатура включается кнопкой, ⌫ стирает букву', () => {
    const { onDone } = renderTask(WordInputTask, 'word-input', ['dog']);
    expect(screen.queryByRole('group', { name: 'Клавиатура иврита' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /экранную клавиатуру/ }));
    const keyboard = screen.getByRole('group', { name: 'Клавиатура иврита' });
    const press = (key: string) => fireEvent.click(within(keyboard).getByRole('button', { name: key }));
    press('א');
    press('Стереть букву');
    for (const letter of Array.from(he('dog'))) press(letter);
    expect(screen.getByRole('textbox')).toHaveValue(he('dog'));
    expect(screen.getByRole('textbox')).toHaveAttribute('readonly');
    fireEvent.click(screen.getByRole('button', { name: 'Проверить' }));
    fireEvent.click(screen.getByRole('button', { name: 'Дальше →' }));
    expect(onDone).toHaveBeenCalledWith([{ wordId: 'dog', correct: true }]);
  });

  it('на экранной клавиатуре стандартная раскладка с конечными буквами', () => {
    const progress = createProgress();
    progress.settings = { ...progress.settings, keyboard: 'screen' };
    renderTask(WordInputTask, 'word-input', ['dog'], progress);
    const keyboard = screen.getByRole('group', { name: 'Клавиатура иврита' });
    const rows = [...keyboard.querySelectorAll('.he-keyboard-row')].map(r => r.textContent);
    expect(rows.slice(0, 3)).toEqual(['קראטוןםפ', 'שדגכעיחלךף', 'זסבהנמצתץ']);
    fireEvent.click(screen.getByRole('button', { name: /системной клавиатурой/ }));
    expect(screen.queryByRole('group', { name: 'Клавиатура иврита' })).toBeNull();
    expect(screen.getByRole('textbox')).not.toHaveAttribute('readonly');
  });

  it('после трёх ошибок показывает ответ', () => {
    const { onDone } = renderTask(WordInputTask, 'word-input', ['dog']);
    type('א');
    type('ב');
    type('ג');
    expect(screen.getByText('✗ Неправильно')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Дальше →' }));
    expect(onDone).toHaveBeenCalledWith([{ wordId: 'dog', correct: false }]);
  });
});

describe('Собери слово', () => {
  const clickTilesFor = (container: HTMLElement, word: string) => {
    const used = new Set<Element>();
    for (const letter of Array.from(word).filter(c => /[א-ת]/.test(c))) {
      const tile = [...container.querySelectorAll('.anagram-tile:not(:disabled)')].find(
        t => t.textContent === letter && !used.has(t)
      )!;
      used.add(tile);
      fireEvent.click(tile);
    }
  };

  it('слово с пробелом собирается из плиток', () => {
    const { container, onDone } = renderTask(AnagramTask, 'anagram', ['potato']);
    expect(container.querySelectorAll('.anagram-slot')).toHaveLength(8);
    expect(container.querySelectorAll('.anagram-tile')).toHaveLength(10);
    clickTilesFor(container, he('potato'));
    fireEvent.click(screen.getByRole('button', { name: 'Дальше →' }));
    expect(onDone).toHaveBeenCalledWith([{ wordId: 'potato', correct: true }]);
  });

  it('«Не знаю» показывает ответ и засчитывает ошибку', () => {
    const { onDone } = renderTask(AnagramTask, 'anagram', ['dog']);
    fireEvent.click(screen.getByRole('button', { name: 'Не знаю, показать ответ' }));
    fireEvent.click(screen.getByRole('button', { name: 'Дальше →' }));
    expect(onDone).toHaveBeenCalledWith([{ wordId: 'dog', correct: false }]);
  });

  it('клетку можно очистить нажатием', () => {
    const { container } = renderTask(AnagramTask, 'anagram', ['dog']);
    fireEvent.click(container.querySelector('.anagram-tile')!);
    const filled = container.querySelector('.anagram-slot.is-filled')!;
    fireEvent.click(filled);
    expect(container.querySelector('.anagram-slot.is-filled')).toBeNull();
  });
});

describe('Найди пары', () => {
  const ids = ['dog', 'cat', 'fish'];
  const pic = (id: string) => screen.getByRole('button', { name: WORD_BY_ID[id].russian });
  const word = (id: string) => screen.getByRole('button', { name: new RegExp(`^${he(id)}`) });

  it('все пары без ошибок — все слова правильные', () => {
    const { onDone } = renderTask(MatchingTask, 'matching', ids);
    for (const id of ids) {
      fireEvent.click(pic(id));
      fireEvent.click(word(id));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Дальше →' }));
    expect(onDone).toHaveBeenCalledWith(ids.map(id => ({ wordId: id, correct: true })));
  });

  it('ошибка отмечает слово, с которого начали пару', () => {
    const { onDone } = renderTask(MatchingTask, 'matching', ids);
    fireEvent.click(pic('dog'));
    fireEvent.click(word('cat'));
    for (const id of ids) {
      fireEvent.click(pic(id));
      fireEvent.click(word(id));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Дальше →' }));
    expect(onDone).toHaveBeenCalledWith([
      { wordId: 'dog', correct: false },
      { wordId: 'cat', correct: true },
      { wordId: 'fish', correct: true },
    ]);
  });
});

describe('Мемори', () => {
  const ids = ['dog', 'cat', 'fish'];
  const FLIP_BACK_DELAY = 1100;

  const setup = () => {
    vi.useFakeTimers();
    const utils = renderTask(MemoryTask, 'memory', ids);
    const cards = () => [...utils.container.querySelectorAll('.memory-card')];
    return { ...utils, cards };
  };

  // Раскладка случайная, поэтому сначала подсматриваем её: открываем непересекающиеся
  // пары карточек (0-1, 2-3, 4-5). Так никогда не остаётся «висящей» одной открытой
  // карточки, и следующие клики не теряются — при любом перемешивании.
  const revealLayout = (cards: () => Element[]) => {
    const layout: string[] = [];
    for (let i = 0; i < cards().length; i += 2) {
      fireEvent.click(cards()[i]);
      fireEvent.click(cards()[i + 1]);
      layout.push(cards()[i].getAttribute('aria-label')!, cards()[i + 1].getAttribute('aria-label')!);
      act(() => vi.advanceTimersByTime(FLIP_BACK_DELAY));
    }
    expect(layout).not.toContain('закрытая карточка');
    return layout;
  };

  const pairOf = (layout: string[], id: string) =>
    [layout.indexOf(WORD_BY_ID[id].russian), layout.indexOf(he(id))];

  it('неверная пара закрывается через паузу, верная остаётся открытой', () => {
    // Фиксированная раскладка, в которой соседние карточки не образуют пар:
    // после подсматривания все три пары ещё не найдены
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { cards } = setup();
    vi.mocked(Math.random).mockRestore();
    const layout = revealLayout(cards);
    expect(cards().filter(c => c.classList.contains('is-matched'))).toHaveLength(0);

    const [dogPic, dogWord] = pairOf(layout, 'dog');
    const [catPic] = pairOf(layout, 'cat');
    fireEvent.click(cards()[dogPic]);
    fireEvent.click(cards()[catPic]);
    expect(cards()[dogPic]).toHaveClass('is-open');
    expect(cards()[catPic]).toHaveClass('is-open');
    act(() => vi.advanceTimersByTime(FLIP_BACK_DELAY));
    expect(cards()[dogPic]).not.toHaveClass('is-open');
    expect(cards()[catPic]).not.toHaveClass('is-open');

    fireEvent.click(cards()[dogPic]);
    fireEvent.click(cards()[dogWord]);
    act(() => vi.advanceTimersByTime(FLIP_BACK_DELAY));
    expect(cards()[dogPic]).toHaveClass('is-matched');
    expect(cards()[dogWord]).toHaveClass('is-matched');
    expect(screen.getByText('Ходов: 5')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Дальше →' })).toBeNull();
  });

  // Раскладка случайная: тест обязан проходить при любом перемешивании
  it('после всех пар — завершение, все слова засчитаны', () => {
    const { cards, onDone } = setup();
    const layout = revealLayout(cards);
    for (const id of ids) {
      const [a, b] = pairOf(layout, id);
      fireEvent.click(cards()[a]);
      fireEvent.click(cards()[b]);
    }
    expect(cards().filter(c => c.classList.contains('is-matched'))).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: 'Дальше →' }));
    expect(onDone).toHaveBeenCalledWith(ids.map(id => ({ wordId: id, correct: true })));
  });
});

describe('Карточки', () => {
  it('новое слово показывается сразу, «Запомнил» засчитывается', () => {
    const { onDone } = renderTask(FlashcardTask, 'flashcards', ['dog']);
    expect(screen.getByText('Новое слово')).toBeInTheDocument();
    expect(screen.getByText(he('dog'))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Запомнил →' }));
    expect(onDone).toHaveBeenCalledWith([{ wordId: 'dog', correct: true }]);
  });

  it('знакомое слово скрыто до «Показать слово», «Не знал» — ошибка', () => {
    const { onDone } = renderTask(FlashcardTask, 'flashcards', ['dog'], progressWithBox('dog', 2));
    expect(screen.queryByText(he('dog'))).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '👁 Показать слово' }));
    fireEvent.click(screen.getByRole('button', { name: '✗ Не знал' }));
    expect(onDone).toHaveBeenCalledWith([{ wordId: 'dog', correct: false }]);
  });
});

describe('Верно или нет', () => {
  it('считает ответы и завершается через 60 секунд', () => {
    vi.useFakeTimers();
    const ids = ['dog', 'cat', 'fish', 'cow'];
    const { container, onDone } = renderTask(SpeedTask, 'speed', ids);
    fireEvent.click(screen.getByRole('button', { name: '▶ Начать' }));
    for (let i = 0; i < 3; i++) {
      const shown = container.querySelector('.speed-card .he')!.textContent;
      const picture = container.querySelector('.speed-card [role=img], .speed-card img')!;
      expect(picture).toBeTruthy();
      expect(shown).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: '✓ Верно' }));
      act(() => vi.advanceTimersByTime(1300));
    }
    for (let s = 0; s < SPEED_DURATION; s++) act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText(/Время вышло/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Итоги →' }));
    const results = onDone.mock.calls[0][0];
    expect(results).toHaveLength(3);
    expect(within(container).queryByText('✓ Верно')).toBeNull();
  });
});

describe('Послушай и выбери', () => {
  it('выбор правильной картинки', () => {
    const { onDone } = renderTask(ListenTask, 'listen', ['dog']);
    expect(screen.getAllByRole('button', { name: /^(?!🔊)/ }).length).toBeGreaterThanOrEqual(4);
    fireEvent.click(screen.getByRole('button', { name: WORD_BY_ID.dog.russian }));
    fireEvent.click(screen.getByRole('button', { name: 'Дальше →' }));
    expect(onDone).toHaveBeenCalledWith([{ wordId: 'dog', correct: true }]);
  });
});
