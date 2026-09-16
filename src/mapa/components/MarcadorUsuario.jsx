import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { MAP_COLORS } from '../../mapLegend';
import {
    buildAppLocationUrl,
    buildGoogleMapsUrl,
    buildLocationShareText,
    buildWhatsAppShareUrl
} from '../../shareLinks';
import { calcularDistanciaMetros } from '../utils/mapGeoUtils';

export const MarcadorUsuario = ({ posicao, direcao, canCreate = false, onCreate }) => {
    const [posicaoAnimada, setPosicaoAnimada] = useState(posicao);
    const frameAnimacaoRef = useRef(null);
    const posicaoAnimadaRef = useRef(posicao);

    useEffect(() => {
        if (!posicao) {
            if (frameAnimacaoRef.current) {
                window.cancelAnimationFrame(frameAnimacaoRef.current);
                frameAnimacaoRef.current = null;
            }
            posicaoAnimadaRef.current = null;
            setPosicaoAnimada(null);
            return undefined;
        }

        if (!posicaoAnimadaRef.current) {
            posicaoAnimadaRef.current = posicao;
            setPosicaoAnimada(posicao);
            return undefined;
        }

        const origem = posicaoAnimadaRef.current;
        const distancia = calcularDistanciaMetros(origem, posicao);

        if (distancia < 0.4) {
            posicaoAnimadaRef.current = posicao;
            setPosicaoAnimada(posicao);
            return undefined;
        }

        if (frameAnimacaoRef.current) {
            window.cancelAnimationFrame(frameAnimacaoRef.current);
        }

        const inicio = performance.now();
        const duracao = 850;

        const animar = (agora) => {
            const progresso = Math.min((agora - inicio) / duracao, 1);
            const easing = 1 - ((1 - progresso) ** 3);
            const proximaPosicao = {
                lat: origem.lat + ((posicao.lat - origem.lat) * easing),
                lng: origem.lng + ((posicao.lng - origem.lng) * easing)
            };

            posicaoAnimadaRef.current = proximaPosicao;
            setPosicaoAnimada(proximaPosicao);

            if (progresso < 1) {
                frameAnimacaoRef.current = window.requestAnimationFrame(animar);
                return;
            }

            frameAnimacaoRef.current = null;
        };

        frameAnimacaoRef.current = window.requestAnimationFrame(animar);

        return () => {
            if (frameAnimacaoRef.current) {
                window.cancelAnimationFrame(frameAnimacaoRef.current);
                frameAnimacaoRef.current = null;
            }
        };
    }, [posicao]);

    const posicaoExibida = posicaoAnimada ?? posicao;

    const iconeGPS = useMemo(() => L.divIcon({
        className: 'bg-transparent',
        html: `
            <div style="position: relative; width: 54px; height: 54px; display: flex; align-items: center; justify-content: center;">
                <div style="position: absolute; width: 38px; height: 38px; border-radius: 9999px; background: rgba(59, 130, 246, 0.18); animation: gps-pulse 1.8s ease-out infinite;"></div>
                ${typeof direcao === 'number' ? `
                    <div style="position: absolute; top: 5px; left: 50%; width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent; border-bottom: 16px solid #1d4ed8; transform: translateX(-50%) rotate(${direcao}deg); transform-origin: 50% 21px; filter: drop-shadow(0 2px 3px rgba(30, 64, 175, 0.3));"></div>
                ` : ''}
                <div style="position: relative; width: 18px; height: 18px; border-radius: 9999px; background: ${MAP_COLORS.apoio.clique}; border: 3px solid #ffffff; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.45); z-index: 2;"></div>
            </div>
        `,
        iconSize: [54, 54],
        iconAnchor: [27, 27]
    }), [direcao]);

    if (!posicaoExibida) return null;

    const compartilharLocalizacao = () => {
        const appUrl = buildAppLocationUrl(posicaoExibida.lat, posicaoExibida.lng, 17);
        const mapsUrl = buildGoogleMapsUrl(posicaoExibida.lat, posicaoExibida.lng);
        const text = buildLocationShareText({
            title: 'Minha localização no território',
            appUrl,
            mapsUrl
        });

        window.open(buildWhatsAppShareUrl(text), '_blank');
    };

    const cadastrarEnderecoAqui = () => {
        onCreate?.({
            lat: posicaoExibida.lat,
            lng: posicaoExibida.lng
        });
    };

    return (
        <Marker position={posicaoExibida} icon={iconeGPS}>
            <Popup>
                <div className="flex min-w-[190px] flex-col gap-2 p-1 text-center">
                    <p className="font-bold text-sm mb-2 text-gray-700">Você está aqui</p>
                    <button onClick={compartilharLocalizacao} className="popup-btn-action bg-blue-600 text-white hover:bg-blue-700 text-xs py-1 px-3 shadow-md">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" /></svg>
                        Compartilhar Local
                    </button>
                    {canCreate && (
                        <button onClick={cadastrarEnderecoAqui} className="popup-btn-action bg-teal-700 text-white hover:bg-teal-800 text-xs py-1 px-3 shadow-md">
                            Cadastrar endereço
                        </button>
                    )}
                </div>
            </Popup>
        </Marker>
    );
};
