import React, { useState, useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { searchAddresses } from '../../addressSearch';
import { useUiFeedback } from '../../uiFeedback';
import { stopMapDomEvent, useLeafletDomEventIsolation } from '../utils/mapDomEvents';

export const AddressSearchControl = ({ isOnline, searchConfig, onSelect }) => {
    const map = useMap();
    const controlRef = useLeafletDomEventIsolation();
    const { notify } = useUiFeedback();
    const abortRef = useRef(null);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [selectedId, setSelectedId] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

    useEffect(() => () => abortRef.current?.abort(), []);

    useEffect(() => {
        const closeMobileSearch = () => setMobileSearchOpen(false);
        map.on('popupopen', closeMobileSearch);

        return () => {
            map.off('popupopen', closeMobileSearch);
        };
    }, [map]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        const text = query.trim();

        if (!isOnline) {
            notify({
                title: 'Busca bloqueada offline',
                message: 'Conecte-se para buscar endereços no OpenStreetMap.',
                variant: 'warning',
                durationMs: 6500
            });
            return;
        }

        if (!text) {
            setMessage('Digite um endereço para buscar.');
            setResults([]);
            return;
        }

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setLoading(true);
        setMessage('');
        setSelectedId('');

        try {
            const found = await searchAddresses(text, { signal: controller.signal, searchConfig });
            setResults(found);
            if (found.length === 1 && found[0].origem === 'coordenadas') {
                selecionarResultado(found[0]);
                setMessage('Coordenadas localizadas no mapa.');
                return;
            }
            setMessage(found.length ? '' : 'Nenhum resultado encontrado na região atendida.');
        } catch (error) {
            if (error?.name === 'AbortError') return;
            console.error('Erro ao buscar endereço:', error);
            setResults([]);
            setMessage(String(error?.message || 'Não foi possível buscar este endereço agora.'));
        } finally {
            if (abortRef.current === controller) {
                abortRef.current = null;
                setLoading(false);
            }
        }
    };

    const selecionarResultado = (result) => {
        setSelectedId(result.id);
        map.flyTo([result.lat, result.lng], Math.max(map.getZoom(), 18), {
            animate: true,
            duration: 0.9
        });
        onSelect(result);
        setMobileSearchOpen(false);
    };

    return (
        <div ref={controlRef} className="map-popup-aware-control pointer-events-auto absolute left-3 right-3 top-4 z-[650] max-w-[440px] sm:right-auto" onClick={stopMapDomEvent}>
            <button
                type="button"
                onClick={() => setMobileSearchOpen(true)}
                className={`flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-xl transition duration-150 hover:bg-slate-50 sm:hidden ${mobileSearchOpen ? 'pointer-events-none scale-90 opacity-0' : 'scale-100 opacity-100'}`}
                aria-label="Abrir busca de endereço"
                title="Buscar endereço"
            >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.1-5.15a6.25 6.25 0 1 1-12.5 0 6.25 6.25 0 0 1 12.5 0Z" />
                </svg>
            </button>
            <form
                onSubmit={handleSubmit}
                className={`absolute left-0 right-0 top-0 origin-top-left rounded-lg border border-slate-200 bg-white/95 p-2 shadow-2xl backdrop-blur transition duration-150 ease-out sm:static sm:pointer-events-auto sm:scale-100 sm:opacity-100 ${mobileSearchOpen ? 'pointer-events-auto scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'}`}
            >
                <div className="flex gap-2">
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Buscar endereço"
                        className="min-w-0 flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="rounded-md bg-teal-700 px-3 py-2 text-sm font-extrabold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-wait disabled:bg-teal-400"
                    >
                        {loading ? 'Buscando' : 'Buscar'}
                    </button>
                    <button
                        type="button"
                        onClick={() => setMobileSearchOpen(false)}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 sm:hidden"
                        aria-label="Fechar busca de endereço"
                        title="Fechar"
                    >
                        <span aria-hidden="true" className="text-lg font-black leading-none">×</span>
                    </button>
                </div>
                {message && (
                    <p className="mt-2 rounded-md bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-600">{message}</p>
                )}
                {results.length > 0 && (
                    <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-slate-100 bg-white">
                        {results.map((result) => (
                            <button
                                key={result.id}
                                type="button"
                                onClick={() => selecionarResultado(result)}
                                className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-xs font-semibold leading-snug transition last:border-b-0 hover:bg-teal-50 ${selectedId === result.id ? 'bg-teal-50 text-teal-800' : 'text-slate-700'}`}
                            >
                                {result.label || result.endereco}
                            </button>
                        ))}
                    </div>
                )}
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Resultados: OpenStreetMap/Nominatim</p>
            </form>
        </div>
    );
};
