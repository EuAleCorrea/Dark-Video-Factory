import { Track, Clip, generateId } from '../types/editor';

/**
 * Timeline Engine Service
 * Responsável por operações puras na timeline do editor de vídeo.
 * Funções imutáveis: recebem o estado das tracks e retornam um novo estado modificado.
 */
export const TimelineEngineService = {
  /**
   * Obtém a duração total da linha do tempo com base no fim do último clipe.
   */
  getTimelineDuration(tracks: Track[]): number {
    let maxTime = 0;
    for (const track of tracks) {
      for (const clip of track.clips) {
        const endTime = clip.startTime + clip.duration;
        if (endTime > maxTime) {
          maxTime = endTime;
        }
      }
    }
    return maxTime;
  },

  /**
   * Adiciona um clipe a uma track. Caso haja colisão, ajusta o início do novo clipe
   * empurrando-o para frente, para não sobrescrever clipes existentes (comportamento tipo Ripple / appended).
   * Num editor real, poderíamos ter opções de sobrescrever, mas vamos simplificar empurrando.
   */
  addClip(tracks: Track[], newClip: Clip): Track[] {
    return tracks.map((track) => {
      if (track.id !== newClip.trackId) {
        return track;
      }

      // Copiar clips e ordenar por tempo
      const sortedClips = [...track.clips].sort((a, b) => a.startTime - b.startTime);
      
      let finalStartTime = newClip.startTime;
      let hasCollision = true;

      // Simplificação básica de resolução de colisão: 
      // Se colidir, empurrar finalStartTime para o final do clipe colidido.
      while (hasCollision) {
        hasCollision = false;
        const newEndTime = finalStartTime + newClip.duration;

        for (const existing of sortedClips) {
          const existingEnd = existing.startTime + existing.duration;
          
          // Verifica interseção
          if (finalStartTime < existingEnd && newEndTime > existing.startTime) {
            hasCollision = true;
            finalStartTime = existingEnd;
            break; // Reinicia a checagem no while loop
          }
        }
      }

      const clipToAdd: Clip = {
        ...newClip,
        startTime: finalStartTime,
      };

      return {
        ...track,
        clips: [...track.clips, clipToAdd],
      };
    });
  },

  /**
   * Remove um clipe pelo ID de qualquer track.
   */
  removeClip(tracks: Track[], clipId: string): Track[] {
    return tracks.map((track) => ({
      ...track,
      clips: track.clips.filter((c) => c.id !== clipId),
    }));
  },

  /**
   * Move um clipe para um novo tempo e/ou nova track.
   * Evita colisões empurrando o newStartTime se necessário.
   */
  moveClip(tracks: Track[], clipId: string, trackId: string, newStartTime: number): Track[] {
    // 1. Acha o clipe original
    let targetClip: Clip | null = null;
    let originalTrackId: string | null = null; // eslint-disable-line @typescript-eslint/no-unused-vars

    for (const track of tracks) {
      const found = track.clips.find((c) => c.id === clipId);
      if (found) {
        targetClip = found;
        originalTrackId = track.id;
        break;
      }
    }

    if (!targetClip) return tracks;

    // 2. Remove da original e recriar como o modificado
    const tracksWithoutClip = this.removeClip(tracks, clipId);
    
    const modifiedClip: Clip = {
      ...targetClip,
      trackId,
      startTime: Math.max(0, newStartTime),
    };

    // 3. Adiciona (com a verificação de colisão do addClip)
    return this.addClip(tracksWithoutClip, modifiedClip);
  },

  /**
   * Redimensiona um clipe (trim). 
   * newSourceStart altera o ponto de corte do arquivo fonte.
   * Não lida com colisão aqui na versão simplificada (apenas atualiza).
   */
  resizeClip(
    tracks: Track[],
    clipId: string,
    newStartTime: number,
    newDuration: number,
    newSourceStart?: number
  ): Track[] {
    return tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => {
        if (clip.id !== clipId) return clip;
        return {
          ...clip,
          startTime: Math.max(0, newStartTime),
          duration: Math.max(0.1, newDuration),
          sourceStart: newSourceStart ?? clip.sourceStart,
        };
      }),
    }));
  },

  /**
   * Pega um clipe e corta no meio, baseado em `splitTime` absoluto na timeline.
   */
  splitClip(tracks: Track[], clipId: string, splitTime: number): Track[] {
    return tracks.map((track) => {
      const clipIndex = track.clips.findIndex((c) => c.id === clipId);
      if (clipIndex === -1) return track;

      const clip = track.clips[clipIndex];

      // O splitTime deve estar dentro do clip
      if (splitTime <= clip.startTime || splitTime >= clip.startTime + clip.duration) {
        return track; // Tempo fora dos limites do clipe
      }

      const durationFirst = splitTime - clip.startTime;
      const durationSecond = clip.duration - durationFirst;

      const firstClip: Clip = {
        ...clip,
        duration: durationFirst,
      };

      const secondClip: Clip = {
        ...clip,
        id: generateId(), // precisa definir este ID lá no top
        startTime: splitTime,
        duration: durationSecond,
        sourceStart: (clip.sourceStart || 0) + durationFirst,
      };

      const newClips = [...track.clips];
      newClips.splice(clipIndex, 1, firstClip, secondClip);

      return {
        ...track,
        clips: newClips,
      };
    });
  },

  /**
   * Retorna o momento no tempo (em segundos) que deve atrair magneticamente o cursor
   * ou um clipe.
   * 'threshold' define a sensibilidade do snap (ex: 0.5s).
   */
  snapToGrid(tracks: Track[], time: number, threshold = 0.5, ignoreClipIds: string[] = []): number {
    let closestTime = time;
    let minDistance = threshold;

    // Zero também é um snap point
    if (time <= threshold) {
      closestTime = 0;
      minDistance = time;
    }

    for (const track of tracks) {
      for (const clip of track.clips) {
        if (ignoreClipIds.includes(clip.id)) continue;

        // Borda inicial
        const distStart = Math.abs(time - clip.startTime);
        if (distStart < minDistance) {
          minDistance = distStart;
          closestTime = clip.startTime;
        }

        // Borda final
        const end = clip.startTime + clip.duration;
        const distEnd = Math.abs(time - end);
        if (distEnd < minDistance) {
          minDistance = distEnd;
          closestTime = end;
        }
      }
    }

    return closestTime;
  },
};
