import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const arrayBufferToBase64 = (arrayBuffer) => {
    const bytes = new Uint8Array(arrayBuffer);
    const chunkSize = 0x8000;
    let binary = '';

    for (let index = 0; index < bytes.length; index += chunkSize) {
        const chunk = bytes.subarray(index, index + chunkSize);
        binary += String.fromCharCode(...chunk);
    }

    return window.btoa(binary);
};

const salvarArquivoNativo = async (path, data) => {
    try {
        await Filesystem.writeFile({
            path,
            data,
            directory: Directory.Documents,
            recursive: true
        });

        return Filesystem.getUri({
            path,
            directory: Directory.Documents
        });
    } catch {
        await Filesystem.writeFile({
            path,
            data,
            directory: Directory.Cache,
            recursive: true
        });

        return Filesystem.getUri({
            path,
            directory: Directory.Cache
        });
    }
};

export const exportarPdfParaDispositivo = async (doc, nomeArquivo) => {
    if (!Capacitor.isNativePlatform()) {
        doc.save(nomeArquivo);
        return { modo: 'download' };
    }

    const pdfBase64 = arrayBufferToBase64(doc.output('arraybuffer'));
    const path = `relatorios/${nomeArquivo}`;
    const { uri } = await salvarArquivoNativo(path, pdfBase64);

    await Share.share({
        title: nomeArquivo,
        text: 'Relatório em PDF',
        url: uri,
        dialogTitle: 'Salvar ou compartilhar PDF'
    });

    return { modo: 'share', uri };
};
