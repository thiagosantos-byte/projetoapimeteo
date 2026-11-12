
import { useEffect, useRef } from 'react';
import { MapPin, Search, LoaderCircle, X } from 'lucide-react';

export default function SearchBox({
  value,
  onChange,
  results = [],
  loading,
  onSelect,
  onSubmit,
  onClear,
  errorMessage = '',
  compact = false
}) {
  const rootRef = useRef(null);

  // Fecha as sugestões quando o usuário clica fora da pesquisa.
  useEffect(() => {
    function closeOnOutside(event) {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target)
      ) {
        onClear?.();
      }
    }

    document.addEventListener('pointerdown', closeOnOutside);

    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
    };
  }, [onClear]);

  // Clique na lupa e tecla Enter executam a mesma ação.
  function handleSubmit(event) {
    event.preventDefault();
    onSubmit?.();
  }

  return (
    <div
      className={`search-box ${
        compact ? 'search-box--compact' : ''
      }`}
      ref={rootRef}
    >
      <form
        className="search-box__field"
        onSubmit={handleSubmit}
      >
        {/* Botão de pesquisa */}
        <button
          type="submit"
          className="icon-button search-submit"
          aria-label="Buscar cidade"
          title="Buscar cidade"
          disabled={loading || value.trim().length < 2}
        >
          {loading ? (
            <LoaderCircle
              className="spin"
              size={16}
            />
          ) : (
            <Search
              size={17}
              aria-hidden="true"
            />
          )}
        </button>

        {/* Campo de pesquisa */}
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Pesquisar cidade..."
          aria-label="Pesquisar cidade"
          autoComplete="off"
        />

        {/* Limpar pesquisa */}
        {value && !loading && (
          <button
            type="button"
            className="icon-button search-clear"
            onClick={() => onChange('')}
            aria-label="Limpar pesquisa"
            title="Limpar pesquisa"
          >
            <X size={15} />
          </button>
        )}
      </form>

      {/* Resultados encontrados */}
      {results.length > 0 && (
        <div
          className="search-results"
          role="listbox"
        >
          {results.map((city) => (
            <button
              key={
                city.id ||
                `${city.latitude}-${city.longitude}`
              }
              type="button"
              className="search-result"
              onClick={() => onSelect?.(city)}
              role="option"
              aria-label={`Selecionar ${city.name}, ${
                [city.region, city.country]
                  .filter(Boolean)
                  .join(', ')
              }`}
            >
              <span className="search-result__pin">
                <MapPin size={15} />
              </span>

              <span>
                <strong>{city.name}</strong>

                <small>
                  {[city.region, city.country]
                    .filter(Boolean)
                    .join(', ')}
                </small>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Mensagens de pesquisa */}
      {value.trim().length >= 2 &&
        !loading &&
        results.length === 0 && (
          <div
            className={`search-feedback ${
              errorMessage
                ? 'search-feedback--error'
                : ''
            }`}
            role="status"
          >
            {errorMessage ||
              'Nenhuma cidade encontrada. Tente informar também o estado ou o país.'}
          </div>
        )}
    </div>
  );
}
