// Главный экран: словарь, серия дней, игры

import { Link } from 'react-router';
import type { GameType, RoundKind } from '../types';
import { recentAccuracy, summarizeVocabulary, visibleStreak } from '../core/progress';
import { WORD_IDS } from '../data/dictionary';
import { GAME_INFO } from '../games/info';
import { TASK_COMPONENTS } from '../games';
import { useProgress } from '../state/progressContext';
import { useSpeechAvailable } from '../hooks/useSpeech';
import { pluralRu } from '../utils/plural';
import VocabularyCard from '../components/VocabularyCard';
import TopicPicker from '../components/TopicPicker';
import InstallCard from '../pwa/InstallCard';

/** Порядок игр в меню. «Угадай букву» используется только в «Тренировке дня». */
const MENU_GAMES: GameType[] = ['matching', 'word-choice', 'anagram', 'memory', 'flashcards', 'speed', 'listen', 'word-input'];

const starsText = (stars: number) => '★'.repeat(stars) + '☆'.repeat(3 - stars);

const HomePage = () => {
  const { progress, today } = useProgress();
  const speechAvailable = useSpeechAvailable();
  const vocabulary = summarizeVocabulary(progress, WORD_IDS, today);
  const streak = visibleStreak(progress.streak, today);
  const todayStats = progress.days[today];

  const games = MENU_GAMES.filter(game =>
    TASK_COMPONENTS[game] &&
    (game !== 'word-input' || progress.settings.typing) &&
    (game !== 'listen' || speechAvailable)
  );

  const gameStatsLine = (kind: RoundKind): string | null => {
    const game = progress.games[kind];
    if (!game || game.rounds === 0) return null;
    const parts = [`последний ${starsText(game.lastStars)}`];
    if (kind === 'speed') parts.push(`рекорд ${game.bestTotal}`);
    else if (game.bestTotal) parts.push(`лучший ${game.bestCorrect}/${game.bestTotal}`);
    const accuracy = recentAccuracy(game, today);
    if (accuracy !== null && kind !== 'speed') parts.push(`точность ${accuracy}%`);
    return parts.join(' · ');
  };

  return (
    <div className="page home">
      <header className="home-header">
        <h1 className="h3 mb-0">Иврит. Тренажёр</h1>
        <div className={`streak ${streak > 0 ? 'is-active' : ''}`} title="Дней подряд">
          🔥 {streak}
        </div>
      </header>

      <div className="today-line">
        {todayStats?.rounds
          ? `Сегодня: ${todayStats.rounds} ${pluralRu(todayStats.rounds, 'раунд', 'раунда', 'раундов')}, ${todayStats.correct} из ${todayStats.total}${todayStats.daily ? ' · цель дня выполнена ✓' : ''}`
          : 'Сегодня ещё не занимались'}
      </div>

      {TASK_COMPONENTS.flashcards && (
        <Link to="/play/daily" state={{ fromHome: true }} className={`daily-button ${todayStats?.daily ? 'is-done' : ''}`}>
          <span className="daily-icon" aria-hidden>{todayStats?.daily ? '✅' : GAME_INFO.daily.icon}</span>
          <span>
            <span className="daily-title">{GAME_INFO.daily.title}</span>
            <span className="daily-subtitle">
              {todayStats?.daily ? 'Выполнено! Можно ещё раз' : vocabulary.due > 0 ? `Повторить ${vocabulary.due} и выучить новые` : 'Новые слова и повторение'}
            </span>
          </span>
        </Link>
      )}

      <VocabularyCard summary={vocabulary} />
      <TopicPicker />

      <h2 className="section-title">Игры</h2>
      <div className="game-grid">
        {games.map(game => {
          const info = GAME_INFO[game];
          const stats = gameStatsLine(game);
          return (
            <Link key={game} to={`/play/${game}`} state={{ fromHome: true }} className="game-tile">
              <span className="game-tile-icon" aria-hidden>{info.icon}</span>
              <span className="game-tile-title">{info.title}</span>
              <span className="game-tile-desc">{info.description}</span>
              {stats && <span className="game-tile-stats">{stats}</span>}
            </Link>
          );
        })}
      </div>

      <nav className="home-nav">
        <Link to="/progress" className="btn btn-outline-primary btn-lg">📊 Прогресс</Link>
        <Link to="/settings" className="btn btn-outline-secondary btn-lg">⚙️ Настройки</Link>
      </nav>

      <InstallCard />
    </div>
  );
};

export default HomePage;
