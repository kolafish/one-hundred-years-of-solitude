const STORAGE_KEY = "ohys_translation_quiz_stats_v1";

function createEmptyStats() {
  return {
    schemaVersion: 2,
    totalSessions: 0,
    totalAnswers: 0,
    versionVotes: {},
    versionAppearances: {},
    questionVotes: {},
    updatedAt: null
  };
}

function getStats() {
  try {
    return normalizeStats(wx.getStorageSync(STORAGE_KEY) || createEmptyStats());
  } catch (error) {
    return createEmptyStats();
  }
}

function normalizeStats(stats) {
  const normalized = {
    ...createEmptyStats(),
    ...stats,
    versionVotes: stats.versionVotes || {},
    versionAppearances: stats.versionAppearances || {},
    questionVotes: stats.questionVotes || {}
  };

  Object.keys(normalized.versionVotes).forEach((versionId) => {
    normalized.versionAppearances[versionId] = Math.max(
      normalized.versionAppearances[versionId] || 0,
      normalized.versionVotes[versionId] || 0
    );
  });

  normalized.schemaVersion = 2;
  return normalized;
}

function saveStats(stats) {
  wx.setStorageSync(STORAGE_KEY, stats);
  return stats;
}

function recordSession(answers) {
  const stats = getStats();
  const now = new Date().toISOString();

  stats.totalSessions += 1;
  stats.totalAnswers += answers.length;
  stats.updatedAt = now;

  answers.forEach((answer) => {
    const appearedVersionIds = answer.appearedVersionIds || [answer.versionId];

    appearedVersionIds.forEach((versionId) => {
      stats.versionAppearances[versionId] = (stats.versionAppearances[versionId] || 0) + 1;
    });

    stats.versionVotes[answer.versionId] = (stats.versionVotes[answer.versionId] || 0) + 1;
    if (!stats.questionVotes[answer.questionId]) {
      stats.questionVotes[answer.questionId] = {};
    }
    stats.questionVotes[answer.questionId][answer.versionId] =
      (stats.questionVotes[answer.questionId][answer.versionId] || 0) + 1;
  });

  return saveStats(stats);
}

function clearStats() {
  return saveStats(createEmptyStats());
}

function exportStats() {
  return JSON.stringify(getStats(), null, 2);
}

module.exports = {
  clearStats,
  exportStats,
  getStats,
  recordSession
};
