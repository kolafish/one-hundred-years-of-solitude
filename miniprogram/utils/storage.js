const STORAGE_KEY = "ohys_translation_quiz_stats_v1";

function createEmptyStats() {
  return {
    schemaVersion: 1,
    totalSessions: 0,
    totalAnswers: 0,
    versionVotes: {},
    questionVotes: {},
    updatedAt: null
  };
}

function getStats() {
  try {
    return wx.getStorageSync(STORAGE_KEY) || createEmptyStats();
  } catch (error) {
    return createEmptyStats();
  }
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
