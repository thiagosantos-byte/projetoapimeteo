import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeftRight, ArrowUp, BarChart3, MapPin, RefreshCw, Scale, X } from 'lucide-react';
import GlassCard from './GlassCard';
import SearchBox from './SearchBox';
import { getWeather, searchCities } from '../services/api';
import { formatDay } from '../utils';

function CityPicker({ label, selected, onSelect, onClear }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const timer = useRef(null);

  useEffect(() => {
    const cleanQuery = query.trim();
    const currentSequence = ++sequence.current;
    if (cleanQuery.length < 2 || selected) {
      setSuggestions([]);
      setSearching(false);
      setError('');
      return undefined;
    }

    setSearching(true);
    setError('');
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const results = await searchCities(cleanQuery);
        if (currentSequence === sequence.current) setSuggestions(results);
      } catch (requestError) {
        if (currentSequence === sequence.current) {
          setSuggestions([]);
          setError(requestError.message || 'Não foi possível pesquisar essa cidade.');
        }
      } finally {
        if (currentSequence === sequence.current) setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer.current);
  }, [query, selected]);

  const chooseCity = (city) => {
    onSelect(city);
    setQuery('');
    setSuggestions([]);
    setError('');
  };

  return (
    <div className="compare-picker">
      <div className="compare-picker__label">{label}</div>
      {selected ? (
        <div className="compare-selected-city">
          <span className="compare-selected-city__pin"><MapPin size={15} /></span>
          <span><strong>{selected.name}</strong><small>{[selected.region, selected.country].filter(Boolean).join(' · ')}</small></span>
          <button type="button" onClick={onClear} aria-label={`Remover ${selected.name}`}><X size={15} /></button>
        </div>
      ) : (
        <SearchBox
          value={query}
          onChange={setQuery}
          results={suggestions}
          loading={searching}
          onSelect={chooseCity}
          onSubmit={() => suggestions[0] && chooseCity(suggestions[0])}
          onClear={() => { setSuggestions([]); setError(''); }}
          errorMessage={error}
        />
      )}
    </div>
  );
}

function SummaryCard({ city, weather, variant }) {
  const current = weather?.current || {};
  const today = weather?.daily?.[0] || {};
  return (
    <div className={`compare-summary compare-summary--${variant}`}>
      <div className="compare-summary__top"><span>{city.name}</span><span>{city.country || city.region}</span></div>
      <div className="compare-summary__temperature">{current.temperature == null ? '—' : Math.round(current.temperature)}<small>°C</small></div>
      <div className="compare-summary__condition">{current.condition || 'Condição não informada'}</div>
      <div className="compare-summary__range">
        <span><ArrowDown size={13} /> Mín. {today.minTemperature == null ? '—' : `${Math.round(today.minTemperature)}°`}</span>
        <span><ArrowUp size={13} /> Máx. {today.maxTemperature == null ? '—' : `${Math.round(today.maxTemperature)}°`}</span>
      </div>
    </div>
  );
}

function temperatureLabel(value) {
  return value == null || !Number.isFinite(Number(value)) ? '—' : `${Math.round(Number(value))}°`;
}

export default function CityComparison({ onCitiesCompared }) {
  const [firstCity, setFirstCity] = useState(null);
  const [secondCity, setSecondCity] = useState(null);
  const [firstWeather, setFirstWeather] = useState(null);
  const [secondWeather, setSecondWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  const sameCity = firstCity && secondCity
    && firstCity.latitude === secondCity.latitude
    && firstCity.longitude === secondCity.longitude;

  const compare = async () => {
    if (!firstCity || !secondCity || sameCity) return;
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError('');
    setFirstWeather(null);
    setSecondWeather(null);
    try {
      const [first, second] = await Promise.all([getWeather(firstCity), getWeather(secondCity)]);
      if (currentRequest === requestId.current) {
        setFirstWeather(first);
        setSecondWeather(second);
        onCitiesCompared?.([firstCity, secondCity]);
      }
    } catch (requestError) {
      if (currentRequest === requestId.current) {
        setError(requestError.message || 'Não foi possível carregar a comparação.');
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  };

  const selectFirst = (city) => {
    requestId.current += 1;
    setLoading(false);
    setFirstCity(city);
    setFirstWeather(null);
    setError('');
  };
  const selectSecond = (city) => {
    requestId.current += 1;
    setLoading(false);
    setSecondCity(city);
    setSecondWeather(null);
    setError('');
  };
  const clearFirst = () => { requestId.current += 1; setLoading(false); setFirstCity(null); setFirstWeather(null); setError(''); };
  const clearSecond = () => { requestId.current += 1; setLoading(false); setSecondCity(null); setSecondWeather(null); setError(''); };

  const dailyRows = useMemo(() => {
    if (!firstWeather || !secondWeather) return [];
    const first = new Map((firstWeather.daily || []).filter((item) => item.date).map((item) => [item.date, item]));
    const second = new Map((secondWeather.daily || []).filter((item) => item.date).map((item) => [item.date, item]));
    const dates = [...new Set([...first.keys(), ...second.keys()])].sort().slice(0, 5);
    return dates.map((date) => ({ date, first: first.get(date) || {}, second: second.get(date) || {} }));
  }, [firstWeather, secondWeather]);

  const bounds = useMemo(() => {
    const values = dailyRows.flatMap((row) => [row.first.minTemperature, row.first.maxTemperature, row.second.minTemperature, row.second.maxTemperature])
      .filter((value) => value != null && Number.isFinite(Number(value))).map(Number);
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 1;
    return { min, range: Math.max(1, max - min) };
  }, [dailyRows]);

  const rangePosition = (minValue, maxValue) => {
    if (minValue == null || maxValue == null) return { left: '0%', width: '0%' };
    const left = ((Number(minValue) - bounds.min) / bounds.range) * 100;
    const width = ((Number(maxValue) - Number(minValue)) / bounds.range) * 100;
    return { left: `${Math.max(0, Math.min(100, left))}%`, width: `${Math.max(2, Math.min(100, width))}%` };
  };

  const ready = firstWeather && secondWeather;
  const canCompare = firstCity && secondCity && !sameCity && !loading;

  return (
    <section className="comparison-section" aria-labelledby="comparison-title">
      <div className="comparison-heading">
        <div>
          <div className="comparison-eyebrow"><Scale size={13} /> COMPARAÇÃO METEOROLÓGICA</div>
          <h2 id="comparison-title">Compare duas cidades</h2>
          <p>Veja lado a lado as condições atuais e a variação das temperaturas mínimas e máximas nos próximos cinco dias.</p>
        </div>
        <div className="comparison-heading__icon"><ArrowLeftRight size={22} /></div>
      </div>

      <GlassCard eyebrow="ESCOLHA OS LOCAIS" icon={MapPin} className="comparison-picker-card">
        <div className="comparison-pickers">
          <CityPicker label="PRIMEIRA CIDADE" selected={firstCity} onSelect={selectFirst} onClear={clearFirst} />
          <div className="comparison-versus">×</div>
          <CityPicker label="SEGUNDA CIDADE" selected={secondCity} onSelect={selectSecond} onClear={clearSecond} />
        </div>
        <div className="comparison-actions">
          <span>{sameCity ? 'Escolha duas cidades diferentes para comparar.' : 'A busca permite selecionar cidades com o mesmo nome em regiões diferentes.'}</span>
          <button type="button" className="compare-action" onClick={compare} disabled={!canCompare}>
            {loading ? <RefreshCw className="spin" size={15} /> : <BarChart3 size={15} />}
            {loading ? 'Comparando...' : ready ? 'Atualizar comparação' : 'Comparar cidades'}
          </button>
        </div>
        {error && <div className="comparison-error" role="alert">{error}</div>}
      </GlassCard>

      {ready && (
        <div className="comparison-results">
          <div className="comparison-summary-grid">
            <SummaryCard city={firstCity} weather={firstWeather} variant="first" />
            <SummaryCard city={secondCity} weather={secondWeather} variant="second" />
          </div>
          <GlassCard eyebrow="MÍNIMAS E MÁXIMAS · PRÓXIMOS 5 DIAS" icon={BarChart3} className="comparison-chart-card">
            <div className="comparison-chart-legend">
              <span><i className="legend-dot legend-dot--first" /> {firstCity.name}</span>
              <span><i className="legend-dot legend-dot--second" /> {secondCity.name}</span>
              <small>As barras representam o intervalo entre a mínima e a máxima de cada dia.</small>
            </div>
            <div className="comparison-day-list">
              {dailyRows.map((row, index) => (
                <div className="comparison-day" key={`${row.date || 'dia'}-${index}`}>
                  <div className="comparison-day__date">{index === 0 ? 'Hoje' : formatDay(row.date)}</div>
                  <div className="comparison-day__city comparison-day__city--first">
                    <div className="comparison-day__values"><span>{firstCity.name}</span><strong>{temperatureLabel(row.first.minTemperature)} <em>—</em> {temperatureLabel(row.first.maxTemperature)}</strong></div>
                    <div className="comparison-range-track"><span style={rangePosition(row.first.minTemperature, row.first.maxTemperature)} /></div>
                  </div>
                  <div className="comparison-day__city comparison-day__city--second">
                    <div className="comparison-day__values"><span>{secondCity.name}</span><strong>{temperatureLabel(row.second.minTemperature)} <em>—</em> {temperatureLabel(row.second.maxTemperature)}</strong></div>
                    <div className="comparison-range-track"><span style={rangePosition(row.second.minTemperature, row.second.maxTemperature)} /></div>
                  </div>
                </div>
              ))}
            </div>
            {!dailyRows.length && <p className="comparison-no-data">A previsão diária não foi retornada para essas cidades.</p>}
            <div className="comparison-chart-footnote">Fonte: Open-Meteo · Temperaturas em °C</div>
          </GlassCard>
          <div className="comparison-updated"><RefreshCw size={12} /> Dados consultados em paralelo para as duas cidades.</div>
        </div>
      )}
    </section>
  );
}
