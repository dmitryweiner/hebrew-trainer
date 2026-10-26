// Выбор темы, из которой брать новые слова

import { WORDS } from '../data/dictionary';
import { CATEGORY_NAMES } from '../data/categories';
import { useProgress } from '../state/progressContext';

const TopicPicker = () => {
  const { progress, updateSettings } = useProgress();
  const topic = progress.settings.topic && progress.settings.topic in CATEGORY_NAMES ? progress.settings.topic : null;
  const freshIn = (category: string) =>
    WORDS.filter(w => w.category === category && !(progress.words[w.id]?.box)).length;

  return (
    <section className="card shadow-sm topic-card">
      <div className="card-body">
        <label htmlFor="topic" className="fw-bold mb-2 d-block">Новые слова из темы</label>
        <select
          id="topic"
          className="form-select form-select-lg"
          value={topic ?? ''}
          onChange={e => updateSettings({ topic: e.target.value || null })}
        >
          <option value="">Все темы вперемешку</option>
          {Object.entries(CATEGORY_NAMES).map(([key, name]) => (
            <option key={key} value={key}>{name} · новых {freshIn(key)}</option>
          ))}
        </select>
        {topic && freshIn(topic) === 0 && (
          <div className="small text-muted mt-2">Все слова этой темы уже начаты — новые будут из других тем.</div>
        )}
      </div>
    </section>
  );
};

export default TopicPicker;
