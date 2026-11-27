// The shells supply storage. The campaign keeps the same save format on both platforms.
const MacondoProgress = (() => {
  const KEY = 'macondo_puzzle_progress_v1';
  const FLAGS = ['ICE_PRESERVED', 'BRIDGE_REPAIRED', 'ARCHIVE_INTACT', 'GOLD_FISH_FORGED'];

  function normalize(value, firstAct) {
    const saved = value?.schemaVersion === 1 ? value : {};
    const completedLevels = {};
    for (const [id, record] of Object.entries(saved.completedLevels || {})) {
      if (!/^\d+$/.test(id) || !Number.isInteger(record?.bestTurns) || record.bestTurns < 0) continue;
      completedLevels[id] = {
        bestTurns: record.bestTurns,
        rank: ['S', 'A', 'B'].includes(record.rank) ? record.rank : 'B',
        relicCollected: record.relicCollected === true,
        ...(['TRUTH', 'ESCAPE'].includes(record.ending) ? { ending: record.ending } : {})
      };
    }
    const list = (candidate, check) => Array.isArray(candidate) ? [...new Set(candidate.filter(check))] : [];
    return {
      schemaVersion: 1,
      unlockedLevels: [...new Set([firstAct, ...list(saved.unlockedLevels, Number.isInteger)])],
      completedLevels,
      unlockedCharacters: list(saved.unlockedCharacters, id => typeof id === 'string'),
      worldFlags: Object.fromEntries(FLAGS.map(flag => [flag, saved.worldFlags?.[flag] === true])),
      lastSelectedLoadout: list(saved.lastSelectedLoadout, id => typeof id === 'string')
    };
  }

  function merge(current, other) {
    const completedLevels = { ...current.completedLevels };
    for (const [id, record] of Object.entries(other.completedLevels)) {
      const previous = completedLevels[id];
      const best = previous && previous.bestTurns <= record.bestTurns ? previous : record;
      const ending = [previous?.ending, record.ending].includes('TRUTH') ? 'TRUTH' : record.ending || previous?.ending;
      completedLevels[id] = {
        ...best, relicCollected: Boolean(previous?.relicCollected || record.relicCollected), ...(ending ? { ending } : {})
      };
    }
    return {
      ...current,
      completedLevels,
      unlockedLevels: [...new Set([...current.unlockedLevels, ...other.unlockedLevels])],
      unlockedCharacters: [...new Set([...current.unlockedCharacters, ...other.unlockedCharacters])],
      worldFlags: Object.fromEntries(FLAGS.map(flag => [flag, current.worldFlags[flag] || other.worldFlags[flag]])),
      lastSelectedLoadout: other.lastSelectedLoadout
    };
  }

  return { KEY, normalize, merge };
})();

if (typeof module === 'object' && module.exports) module.exports = MacondoProgress;
