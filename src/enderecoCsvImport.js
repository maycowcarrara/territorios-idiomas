import {
    ENDERECO_CLASSES,
    ENDERECO_STATUS,
    getEnderecoDocIdFromCodigo,
    getGrupoEnderecoDocIdFromCodigo,
    isCodigoManualValido,
    normalizeCodigoManual
} from './enderecoModel.js';
import { normalizeEnderecoConfig } from './enderecoConfig.js';
import { normalizeAddressSearchConfig } from './addressSearchConfig.js';

const COLUMN_INDEX = Object.freeze({
    territorio: 0,
    codigo: 1,
    bairro: 2,
    endereco: 3,
    informacao: 4,
    classe: 5,
    quantidadeEstrangeiros: 6,
    latLong: 7,
    latitude: 8,
    longitude: 9,
    linkMaps: 10
});

const HEADER_ALIASES = Object.freeze({
    territorio: ['territorio', 'territory'],
    bairro: ['barrio', 'bairro'],
    endereco: ['direccion', 'direcao', 'endereco', 'address'],
    informacao: ['informacion', 'informacao', 'informacoes'],
    classe: ['classe', 'class'],
    latLong: ['latlong', 'latlng', 'coordenadas'],
    latitude: ['latitude', 'lat'],
    longitude: ['longitude', 'lng', 'long'],
    linkMaps: ['linkmaps', 'googlemaps', 'maps']
});

const MAX_PREVIEW_ITEMS = 12;

const stripDiacritics = (value) => (
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
);

const normalizeHeaderKey = (value) => (
    stripDiacritics(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '')
);

const normalizeText = (value, maxLength = 220) => (
    String(value ?? '').trim().slice(0, maxLength)
);

const parseCsv = (csvText) => {
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;
    const text = String(csvText || '').replace(/^\uFEFF/, '');

    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        const next = text[index + 1];

        if (inQuotes) {
            if (char === '"' && next === '"') {
                cell += '"';
                index += 1;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                cell += char;
            }
            continue;
        }

        if (char === '"') {
            inQuotes = true;
            continue;
        }

        if (char === ',') {
            row.push(cell);
            cell = '';
            continue;
        }

        if (char === '\n') {
            row.push(cell);
            rows.push(row);
            row = [];
            cell = '';
            continue;
        }

        if (char !== '\r') {
            cell += char;
        }
    }

    if (cell || row.length) {
        row.push(cell);
        rows.push(row);
    }

    return rows.filter((csvRow) => csvRow.some((value) => String(value || '').trim()));
};

const findHeaderIndex = (headers, field) => {
    const aliases = HEADER_ALIASES[field] || [];
    const normalizedHeaders = headers.map(normalizeHeaderKey);
    const matchIndex = normalizedHeaders.findIndex((header) => aliases.some((alias) => header.includes(alias)));

    return matchIndex >= 0 ? matchIndex : COLUMN_INDEX[field];
};

const resolveColumnIndex = (headers, field) => (
    headers.length > COLUMN_INDEX[field]
        ? COLUMN_INDEX[field]
        : findHeaderIndex(headers, field)
);

const buildColumnMap = (headers) => ({
    territorio: resolveColumnIndex(headers, 'territorio'),
    codigo: COLUMN_INDEX.codigo,
    bairro: resolveColumnIndex(headers, 'bairro'),
    endereco: resolveColumnIndex(headers, 'endereco'),
    informacao: resolveColumnIndex(headers, 'informacao'),
    classe: resolveColumnIndex(headers, 'classe'),
    quantidadeEstrangeiros: COLUMN_INDEX.quantidadeEstrangeiros,
    latLong: resolveColumnIndex(headers, 'latLong'),
    latitude: resolveColumnIndex(headers, 'latitude'),
    longitude: resolveColumnIndex(headers, 'longitude'),
    linkMaps: resolveColumnIndex(headers, 'linkMaps')
});

const getCell = (row, columnMap, field) => normalizeText(row[columnMap[field]] || '', 4000);

const normalizeClasseCsv = (value, fallback) => {
    const normalized = normalizeHeaderKey(value);
    if (!normalized) return fallback;
    if (normalized.includes('excluido') || normalized.includes('excluir') || normalized.includes('arquivado')) {
        return ENDERECO_CLASSES.EXCLUIDO;
    }
    if (normalized.includes('estudio') || normalized.includes('estudo')) {
        return ENDERECO_CLASSES.ESTUDO;
    }
    if (normalized.includes('chequear') || normalized.includes('verificar') || normalized.includes('revisar')) {
        return ENDERECO_CLASSES.VERIFICAR;
    }
    if (normalized.includes('confirmado')) {
        return ENDERECO_CLASSES.CONFIRMADO;
    }
    return fallback;
};

const normalizeQuantidade = (value, fallback) => {
    const number = Number.parseInt(String(value || '').replace(/[^\d-]+/g, ''), 10);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(0, Math.min(99, number));
};

const parseCoordinateNumber = (value) => {
    const number = Number.parseFloat(String(value ?? '').trim().replace(',', '.'));
    return Number.isFinite(number) ? number : null;
};

const isValidCoordinate = (point) => (
    point &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lng) <= 180
);

const isInsideViewbox = (point, searchConfig) => {
    const config = normalizeAddressSearchConfig(searchConfig);
    const areas = config.areas?.length ? config.areas : [{ viewbox: config.viewbox }];

    return areas.some((area) => (
        point.lat <= area.viewbox.top &&
        point.lat >= area.viewbox.bottom &&
        point.lng >= area.viewbox.left &&
        point.lng <= area.viewbox.right
    ));
};

const buildCoordinateCandidate = (lat, lng) => {
    const direct = { lat, lng };
    const correctedLongitude = lng > 0 ? { lat, lng: -lng } : null;

    return [direct, correctedLongitude].filter(isValidCoordinate);
};

const resolveCoordinatePair = (first, second, searchConfig) => {
    const firstNumber = parseCoordinateNumber(first);
    const secondNumber = parseCoordinateNumber(second);
    if (firstNumber === null || secondNumber === null) return null;

    const candidates = [
        ...buildCoordinateCandidate(firstNumber, secondNumber),
        ...buildCoordinateCandidate(secondNumber, firstNumber)
    ];
    return candidates.find((candidate) => isInsideViewbox(candidate, searchConfig)) || null;
};

const parseCoordinatePairText = (value, searchConfig) => {
    const matches = String(value || '').match(/-?\d{1,3}(?:[.,]\d+)?/g) || [];
    if (matches.length < 2) return null;
    return resolveCoordinatePair(matches[0], matches[1], searchConfig);
};

const resolveCoordinates = ({ latLong, latitude, longitude }, searchConfig) => {
    const fromPair = parseCoordinatePairText(latLong, searchConfig);
    if (fromPair) {
        return {
            lat: fromPair.lat,
            lng: fromPair.lng,
            coordenadaOrigem: 'planilha'
        };
    }

    const fromColumns = resolveCoordinatePair(latitude, longitude, searchConfig);
    if (fromColumns) {
        return {
            lat: fromColumns.lat,
            lng: fromColumns.lng,
            coordenadaOrigem: 'planilha'
        };
    }

    return {
        lat: null,
        lng: null,
        coordenadaOrigem: null
    };
};

const buildImportacaoId = () => {
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    return `csv_${stamp}`;
};

const getExistingCodigoMap = (existingEnderecos = []) => {
    const map = new Map();
    existingEnderecos.forEach((endereco) => {
        const codigo = normalizeCodigoManual(endereco?.codigo);
        if (codigo) map.set(codigo, endereco);
    });
    return map;
};

const getExistingGrupoMap = (existingGrupos = []) => {
    const map = new Map();
    existingGrupos.forEach((grupo) => {
        const codigo = normalizeCodigoManual(grupo?.codigo);
        if (codigo) map.set(codigo, grupo);
    });
    return map;
};

export const parseEnderecoCsvRows = (csvText, configInput = {}) => {
    const config = normalizeEnderecoConfig(configInput);
    const searchConfig = normalizeAddressSearchConfig(config.buscaEndereco);
    const csvRows = parseCsv(csvText);
    const [headers = [], ...dataRows] = csvRows;
    const columnMap = buildColumnMap(headers);
    const importacaoId = buildImportacaoId();

    return dataRows.map((row, index) => {
        const codigo = normalizeCodigoManual(getCell(row, columnMap, 'codigo'));
        const territorioCodigo = normalizeCodigoManual(getCell(row, columnMap, 'territorio'));
        const classe = normalizeClasseCsv(getCell(row, columnMap, 'classe'), config.classeEnderecoPadrao);
        const coordinates = resolveCoordinates({
            latLong: getCell(row, columnMap, 'latLong'),
            latitude: getCell(row, columnMap, 'latitude'),
            longitude: getCell(row, columnMap, 'longitude')
        }, searchConfig);
        const status = classe === ENDERECO_CLASSES.EXCLUIDO ? ENDERECO_STATUS.ARQUIVADO : ENDERECO_STATUS.ATIVO;
        const endereco = normalizeText(getCell(row, columnMap, 'endereco'), 220);
        const bairro = normalizeText(getCell(row, columnMap, 'bairro'), 120);
        const informacao = normalizeText(getCell(row, columnMap, 'informacao'), 2000);
        const errors = [];

        if (!codigo) {
            errors.push('Código obrigatório.');
        } else if (!isCodigoManualValido(codigo)) {
            errors.push('Código inválido.');
        }

        if (territorioCodigo && !isCodigoManualValido(territorioCodigo)) {
            errors.push('Território inválido.');
        }

        if (!endereco) {
            errors.push('Endereço obrigatório.');
        }

        return {
            rowKey: `linha-${index + 2}`,
            rowNumber: index + 2,
            codigo,
            enderecoId: codigo ? getEnderecoDocIdFromCodigo(codigo) : null,
            territorioCodigo,
            grupoId: territorioCodigo ? getGrupoEnderecoDocIdFromCodigo(territorioCodigo) : null,
            bairro,
            endereco,
            informacao,
            observacao: informacao,
            classe,
            status,
            quantidadeEstrangeiros: normalizeQuantidade(getCell(row, columnMap, 'quantidadeEstrangeiros'), config.quantidadeEstrangeirosPadrao),
            idiomaId: config.idiomaPadraoId,
            idiomaNome: config.idiomaPadraoNome,
            lat: coordinates.lat,
            lng: coordinates.lng,
            coordenadaOrigem: coordinates.coordenadaOrigem,
            importacaoId,
            errors,
            duplicate: false,
            existing: null,
            existingGrupo: null,
            conflicts: [],
            action: 'pendente'
        };
    });
};

const buildGeocodeQuery = (row, configInput = {}) => {
    const config = normalizeEnderecoConfig(configInput);
    return [
        row.endereco,
        row.bairro,
        config.cidadePadrao,
        config.ufPadrao,
        'Brasil'
    ].filter(Boolean).join(', ');
};

const rowHasCoordinates = (row) => (
    row.lat !== null &&
    row.lng !== null &&
    isValidCoordinate({ lat: Number(row.lat), lng: Number(row.lng) })
);

const IMPORT_COMPARE_FIELDS = [
    'lat',
    'lng',
    'idiomaId',
    'idiomaNome',
    'bairro',
    'endereco',
    'informacao',
    'observacao',
    'quantidadeEstrangeiros',
    'classe',
    'status'
];

const getComparableValue = (value, field) => {
    if (['lat', 'lng'].includes(field)) {
        const number = Number(value);
        return Number.isFinite(number) ? Number(number.toFixed(7)) : null;
    }

    if (field === 'quantidadeEstrangeiros') {
        return Math.max(0, Math.trunc(Number(value) || 0));
    }

    return String(value ?? '').trim();
};

const rowDiffersFromExisting = (row, existing) => (
    Boolean(existing) &&
    IMPORT_COMPARE_FIELDS.some((field) => (
        getComparableValue(row[field], field) !== getComparableValue(existing[field], field)
    ))
);

export const buildEnderecoCsvPreview = (rows, {
    existingEnderecos = [],
    existingGrupos = [],
    config = {}
} = {}) => {
    const existingByCodigo = getExistingCodigoMap(existingEnderecos);
    const gruposByCodigo = getExistingGrupoMap(existingGrupos);
    const codigoCounts = new Map();

    rows.forEach((row) => {
        if (!row.codigo) return;
        codigoCounts.set(row.codigo, (codigoCounts.get(row.codigo) || 0) + 1);
    });

    const previewRows = rows.map((row) => {
        const duplicate = row.codigo && codigoCounts.get(row.codigo) > 1;
        const existing = row.codigo ? existingByCodigo.get(row.codigo) || null : null;
        const existingGrupo = row.territorioCodigo ? gruposByCodigo.get(row.territorioCodigo) || null : null;
        const errors = [...row.errors];
        const conflicts = [];
        const hasCoordinates = rowHasCoordinates(row);
        const active = row.status === ENDERECO_STATUS.ATIVO;

        if (duplicate) {
            errors.push('Código duplicado na planilha.');
        }

        if (existing && row.territorioCodigo && active) {
            const grupoAtual = normalizeCodigoManual(existing.grupoCodigo);
            if (grupoAtual && grupoAtual !== row.territorioCodigo) {
                conflicts.push(`Endereço já está no território ${grupoAtual}.`);
            }
        }

        if (!existing && row.territorioCodigo && active && existingGrupo && existingGrupo.status && existingGrupo.status !== 'ativo') {
            conflicts.push(`Território ${row.territorioCodigo} não está ativo.`);
        }

        const canInsert = !existing && !duplicate && !errors.length && !conflicts.length && hasCoordinates;
        const canUpdate = Boolean(existing) && !duplicate && !errors.length && !conflicts.length && hasCoordinates && rowDiffersFromExisting(row, existing);
        const canApply = canInsert || canUpdate;
        const canLinkTerritorio = canInsert && active && Boolean(row.territorioCodigo);
        const action = conflicts.length
            ? 'conflito'
            : existing
                ? canUpdate ? 'atualizar' : 'existente'
                : errors.length
                    ? 'invalido'
                    : !hasCoordinates
                        ? 'sem-coordenada'
                        : 'novo';

        return {
            ...row,
            duplicate: Boolean(duplicate),
            existing,
            existingGrupo,
            errors,
            conflicts,
            hasCoordinates,
            canInsert,
            canUpdate,
            canApply,
            canLinkTerritorio,
            geocodeQuery: !hasCoordinates ? buildGeocodeQuery(row, config) : '',
            action
        };
    });

    const territoriosCriar = [...new Set(previewRows
        .filter((row) => row.canLinkTerritorio && !row.existingGrupo)
        .map((row) => row.territorioCodigo))];
    const territoriosExistentes = [...new Set(previewRows
        .filter((row) => row.canLinkTerritorio && row.existingGrupo)
        .map((row) => row.territorioCodigo))];
    const totals = {
        total: previewRows.length,
        novos: previewRows.filter((row) => row.action === 'novo').length,
        atualizar: previewRows.filter((row) => row.action === 'atualizar').length,
        existentes: previewRows.filter((row) => row.existing).length,
        duplicados: previewRows.filter((row) => row.duplicate).length,
        invalidos: previewRows.filter((row) => row.action === 'invalido').length,
        semCoordenada: previewRows.filter((row) => row.action === 'sem-coordenada').length,
        conflitos: previewRows.filter((row) => row.conflicts.length).length,
        inserir: previewRows.filter((row) => row.canInsert).length,
        aplicar: previewRows.filter((row) => row.canApply).length,
        territoriosCriar: territoriosCriar.length,
        territoriosExistentes: territoriosExistentes.length
    };

    return {
        importacaoId: previewRows[0]?.importacaoId || buildImportacaoId(),
        rows: previewRows,
        totals,
        territoriosCriar,
        territoriosExistentes,
        samples: {
            aplicaveis: previewRows.filter((row) => row.canApply).slice(0, MAX_PREVIEW_ITEMS),
            invalidos: previewRows.filter((row) => row.action === 'invalido').slice(0, MAX_PREVIEW_ITEMS),
            conflitos: previewRows.filter((row) => row.action === 'conflito').slice(0, MAX_PREVIEW_ITEMS),
            semCoordenada: previewRows.filter((row) => row.action === 'sem-coordenada').slice(0, MAX_PREVIEW_ITEMS)
        }
    };
};

export const analyzeEnderecoCsvImport = ({
    csvText,
    config,
    existingEnderecos = [],
    existingGrupos = []
}) => buildEnderecoCsvPreview(parseEnderecoCsvRows(csvText, config), {
    config,
    existingEnderecos,
    existingGrupos
});

export const applyEnderecoCsvGeocoding = (preview, {
    coordinatesByRowKey = {},
    config,
    existingEnderecos = [],
    existingGrupos = []
} = {}) => {
    const rows = (preview?.rows || []).map((row) => {
        const coordinates = coordinatesByRowKey[row.rowKey];
        if (!coordinates || !isValidCoordinate(coordinates)) return row;

        return {
            ...row,
            lat: Number(coordinates.lat),
            lng: Number(coordinates.lng),
            coordenadaOrigem: 'geocodificacao'
        };
    });

    return buildEnderecoCsvPreview(rows, {
        config,
        existingEnderecos,
        existingGrupos
    });
};
