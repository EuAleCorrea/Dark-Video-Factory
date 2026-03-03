/**
 * SrtConverterService — Converte roteiro em SRT para CapCut
 *
 * Algoritmo: divide texto em blocos de ~500 chars / 100 palavras,
 * cortando no último ponto final. Cada bloco dura 30s com 12s de intervalo.
 * Compatível com importação direta no CapCut para TTS.
 */

const CARACTERES_POR_BLOCO = 500;
const PALAVRAS_MAX_BLOCO = 100;
const DURACAO_BLOCO = 30;
const INTERVALO_ENTRE_BLOCOS = 12;

function pad(numero: number, tamanho = 2): string {
    return numero.toString().padStart(tamanho, '0');
}

function formatarTempo(segundos: number): string {
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const segsRestantes = Math.floor(segundos % 60);
    const milissegundos = Math.floor((segundos % 1) * 1000);
    return `${pad(horas)}:${pad(minutos)}:${pad(segsRestantes)},${pad(milissegundos, 3)}`;
}

function formatarBlocoSRT(contador: number, tempoInicio: number, texto: string): string {
    const tempoFim = tempoInicio + DURACAO_BLOCO;
    return `${contador}\n${formatarTempo(tempoInicio)} --> ${formatarTempo(tempoFim)}\n${texto.trim()}\n\n`;
}

export function converterParaSRT(texto: string): string {
    let srt = '';
    let contador = 1;
    let tempoAcumulado = 0;
    const palavras = texto.split(/\s+/);
    let blocoAtual = '';
    let palavrasNoBloco = 0;

    for (const palavra of palavras) {
        if (blocoAtual.length + palavra.length <= CARACTERES_POR_BLOCO && palavrasNoBloco < PALAVRAS_MAX_BLOCO) {
            blocoAtual += palavra + ' ';
            palavrasNoBloco++;
        } else {
            const ultimoPontoFinal = blocoAtual.lastIndexOf('.');
            if (ultimoPontoFinal !== -1 && ultimoPontoFinal !== blocoAtual.length - 1) {
                const resto = blocoAtual.substring(ultimoPontoFinal + 1);
                blocoAtual = blocoAtual.substring(0, ultimoPontoFinal + 1);
                srt += formatarBlocoSRT(contador, tempoAcumulado, blocoAtual);
                contador++;
                tempoAcumulado += DURACAO_BLOCO + INTERVALO_ENTRE_BLOCOS;
                blocoAtual = resto + palavra + ' ';
                palavrasNoBloco = resto.split(/\s+/).length + 1;
            } else {
                srt += formatarBlocoSRT(contador, tempoAcumulado, blocoAtual);
                contador++;
                tempoAcumulado += DURACAO_BLOCO + INTERVALO_ENTRE_BLOCOS;
                blocoAtual = palavra + ' ';
                palavrasNoBloco = 1;
            }
        }
    }

    if (blocoAtual.trim()) {
        srt += formatarBlocoSRT(contador, tempoAcumulado, blocoAtual);
    }

    return srt.trim();
}

/**
 * Retorna stats sobre o SRT gerado
 */
export function getSrtStats(srtContent: string): { blocos: number; duracaoTotal: string } {
    const blocos = (srtContent.match(/^\d+$/gm) || []).length;
    const duracaoSegundos = blocos * DURACAO_BLOCO + (blocos - 1) * INTERVALO_ENTRE_BLOCOS;
    const min = Math.floor(duracaoSegundos / 60);
    const seg = duracaoSegundos % 60;
    return {
        blocos,
        duracaoTotal: `${min}m${pad(seg)}s`
    };
}
