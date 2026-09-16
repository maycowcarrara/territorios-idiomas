import { useState, useEffect, useMemo, useCallback } from 'react';
import { onSnapshot } from 'firebase/firestore';
import {
    DEFAULT_ENDERECO_CONFIG,
    getEnderecoConfigRef,
    getEnderecoConfigForIdioma,
    getEnderecoIdiomasAtivos,
    normalizeEnderecoConfig
} from '../../enderecoConfig';
import { IDIOMA_PADRAO_ENDERECOS } from '../../enderecoModel';

export const ENDERECO_IDIOMA_ATIVO_STORAGE_KEY = 'territorios-idiomas.enderecoIdiomaAtivo';

export const useEnderecoConfigIdioma = ({ db, isAdmin }) => {
    const [enderecoConfig, setEnderecoConfig] = useState(DEFAULT_ENDERECO_CONFIG);
    const [enderecoIdiomaAtivoId, setEnderecoIdiomaAtivoId] = useState('');

    useEffect(() => {
        if (!isAdmin) {
            setEnderecoConfig(DEFAULT_ENDERECO_CONFIG);
            setEnderecoIdiomaAtivoId('');
            return undefined;
        }

        const unsubscribe = onSnapshot(getEnderecoConfigRef(db), (snapshot) => {
            setEnderecoConfig(normalizeEnderecoConfig(snapshot.exists() ? snapshot.data() : DEFAULT_ENDERECO_CONFIG));
        }, (error) => {
            console.error('Erro ao carregar padrões de cadastro:', error);
            setEnderecoConfig(DEFAULT_ENDERECO_CONFIG);
        });

        return unsubscribe;
    }, [db, isAdmin]);

    const enderecoConfigNormalizada = useMemo(() => normalizeEnderecoConfig(enderecoConfig), [enderecoConfig]);
    const enderecoIdiomasAtivos = useMemo(() => getEnderecoIdiomasAtivos(enderecoConfigNormalizada), [enderecoConfigNormalizada]);

    const idiomaAtivoEndereco = useMemo(() => {
        const idiomaId = String(enderecoIdiomaAtivoId || '').trim().toLowerCase();
        return enderecoIdiomasAtivos.find((idioma) => idioma.id === idiomaId) ||
            enderecoIdiomasAtivos.find((idioma) => idioma.id === enderecoConfigNormalizada.idiomaPadraoId) ||
            enderecoIdiomasAtivos[0] ||
            null;
    }, [enderecoConfigNormalizada.idiomaPadraoId, enderecoIdiomaAtivoId, enderecoIdiomasAtivos]);

    const enderecoConfigAtiva = useMemo(() => (
        getEnderecoConfigForIdioma(enderecoConfigNormalizada, idiomaAtivoEndereco?.id)
    ), [enderecoConfigNormalizada, idiomaAtivoEndereco?.id]);

    const mostrarAlternadorIdiomaEndereco = isAdmin && enderecoIdiomasAtivos.length > 1;
    const filtrarPorIdiomaEndereco = mostrarAlternadorIdiomaEndereco && Boolean(idiomaAtivoEndereco?.id);

    const getItemIdiomaId = useCallback((item) => (
        String(item?.idiomaId || IDIOMA_PADRAO_ENDERECOS.id).trim().toLowerCase()
    ), []);

    const pertenceAoIdiomaAtivoEndereco = useCallback((item) => (
        !filtrarPorIdiomaEndereco || getItemIdiomaId(item) === idiomaAtivoEndereco?.id
    ), [filtrarPorIdiomaEndereco, getItemIdiomaId, idiomaAtivoEndereco?.id]);

    useEffect(() => {
        if (!isAdmin || !enderecoIdiomasAtivos.length) return;

        setEnderecoIdiomaAtivoId((current) => {
            const currentId = String(current || '').trim().toLowerCase();
            if (enderecoIdiomasAtivos.some((idioma) => idioma.id === currentId)) {
                return currentId;
            }

            let storedId = '';
            try {
                storedId = String(window.localStorage?.getItem(ENDERECO_IDIOMA_ATIVO_STORAGE_KEY) || '').trim().toLowerCase();
            } catch {
                storedId = '';
            }
            if (enderecoIdiomasAtivos.some((idioma) => idioma.id === storedId)) {
                return storedId;
            }

            return enderecoConfigNormalizada.idiomaPadraoId;
        });
    }, [enderecoConfigNormalizada.idiomaPadraoId, enderecoIdiomasAtivos, isAdmin]);

    const selecionarIdiomaAtivoEndereco = useCallback((idiomaId) => {
        const normalizedIdiomaId = String(idiomaId || '').trim().toLowerCase();
        setEnderecoIdiomaAtivoId(normalizedIdiomaId);
        try {
            window.localStorage?.setItem(ENDERECO_IDIOMA_ATIVO_STORAGE_KEY, normalizedIdiomaId);
        } catch {
            // Ignora falha de storage em modo restrito
        }
    }, []);

    return {
        enderecoConfig,
        enderecoConfigNormalizada,
        enderecoIdiomasAtivos,
        idiomaAtivoEndereco,
        enderecoConfigAtiva,
        mostrarAlternadorIdiomaEndereco,
        filtrarPorIdiomaEndereco,
        enderecoIdiomaAtivoId,
        setEnderecoIdiomaAtivoId,
        selecionarIdiomaAtivoEndereco,
        getItemIdiomaId,
        pertenceAoIdiomaAtivoEndereco
    };
};
