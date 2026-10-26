// Страница раунда: задания по очереди, затем итоги

import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useBlocker, useLocation, useNavigate, useParams } from 'react-router';
import type { RoundKind } from '../types';
import { buildRound } from '../core/scheduler';
import { summarizeRound } from '../core/round';
import { WORDS } from '../data/dictionary';
import { GAME_INFO } from '../games/info';
import { TASK_COMPONENTS } from '../games';
import { useRound } from '../hooks/useRound';
import { useProgress } from '../state/progressContext';
import GameShell from '../components/game/GameShell';
import RoundSummary from '../components/game/RoundSummary';
import ConfirmDialog from '../components/game/ConfirmDialog';
import { useSpeechAvailable } from '../hooks/useSpeech';

const isRoundKind = (kind: string | undefined): kind is RoundKind => !!kind && kind in GAME_INFO;

const PlayPage = () => {
  const { kind } = useParams();
  const location = useLocation();
  if (!isRoundKind(kind)) return <Navigate to="/" replace />;
  const wordIds = new URLSearchParams(location.search).get('words')?.split(',').filter(Boolean);
  // При «Ещё раунд» / «Повторить ошибки» меняется location.key — раунд собирается заново.
  // Вид игры и слова в ключе нужны для переходов по ссылке, у которых key всегда "default".
  return <RoundRunner key={`${kind}${location.search}#${location.key}`} kind={kind} wordIds={wordIds} />;
};

interface RoundRunnerProps {
  kind: RoundKind;
  wordIds?: string[];
}

const RoundRunner = ({ kind, wordIds }: RoundRunnerProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { progress, today, recordRound } = useProgress();
  const ttsAvailable = useSpeechAvailable();
  const [tasks] = useState(() =>
    buildRound(kind, progress, WORDS, today, {
      typing: progress.settings.typing,
      tts: ttsAvailable,
      wordIds,
      topic: progress.settings.topic,
    })
  );
  const { state, task, finished, answer } = useRound(kind, tasks);
  const [record] = useState(() => progress.games.speed?.bestTotal ?? 0);
  const info = GAME_INFO[kind];

  const summary = useMemo(() => (finished ? summarizeRound(state, progress) : null), [finished, state, progress]);

  const recorded = useRef(false);
  useEffect(() => {
    if (!summary || recorded.current) return;
    recorded.current = true;
    recordRound(kind, summary.correct, summary.total);
  }, [summary, kind, recordRound]);

  // Выход и «Назад» на Android посреди раунда спрашивают подтверждение
  const blocker = useBlocker(!finished && state.answers.length > 0);
  const fromHome = (location.state as { fromHome?: boolean } | null)?.fromHome === true;
  const goHome = () => (fromHome ? navigate(-1) : navigate('/', { replace: true }));
  const restart = (path: string) => navigate(path, { replace: true, state: location.state });

  if (tasks.length === 0) {
    return (
      <div className="page text-center">
        <p className="lead mt-5">Для этой игры пока нет подходящих слов.</p>
        <button className="btn btn-success btn-lg" onClick={goHome}>В меню</button>
      </div>
    );
  }

  if (summary) {
    const mistakesGame = kind === 'daily' ? 'word-choice' : kind;
    return (
      <div className="page">
        <RoundSummary
          kind={kind}
          summary={summary}
          boxes={Object.fromEntries(Object.entries(progress.words).map(([id, wp]) => [id, wp.box]))}
          record={kind === 'speed' ? record : undefined}
          onRepeatMistakes={() => restart(`/play/${mistakesGame}?words=${summary.mistakes.join(',')}`)}
          onAgain={() => restart(`/play/${kind}`)}
          onMenu={goHome}
        />
      </div>
    );
  }

  const TaskComponent = task ? TASK_COMPONENTS[task.game] : undefined;
  const taskInfo = task ? GAME_INFO[task.game] : info;

  return (
    <GameShell title={kind === 'daily' ? `${info.title}: ${taskInfo.title}` : info.title} icon={taskInfo.icon} round={state} onExit={goHome}>
      {task && TaskComponent && <TaskComponent key={task.id} task={task} onDone={answer} />}
      {blocker.state === 'blocked' && (
        <ConfirmDialog
          title="Прервать раунд?"
          text="Ответы, которые вы уже дали, сохранятся."
          confirmLabel="Выйти в меню"
          cancelLabel="Продолжить раунд"
          onCancel={() => blocker.reset()}
          onConfirm={() => blocker.proceed()}
        />
      )}
    </GameShell>
  );
};

export default PlayPage;
