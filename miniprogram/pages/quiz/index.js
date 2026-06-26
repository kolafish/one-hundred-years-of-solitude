const questionBank = require("../../data/questions.js");
const statsStore = require("../../utils/storage.js");

const SESSION_SIZE = 10;
const OPTION_COUNT = 3;
const LABELS = ["A", "B", "C"];

Page({
  data: {
    mode: "quiz",
    currentIndex: 0,
    currentNumber: 1,
    sessionTotal: SESSION_SIZE,
    isLastQuestion: false,
    currentQuestion: null,
    questions: [],
    answers: [],
    stats: statsStore.getStats()
  },

  onLoad() {
    this.restartSession();
  },

  restartSession() {
    const readyQuestions = questionBank.questions.filter(isUsableQuestion);
    const fallbackQuestions = questionBank.questions.filter(
      (question) => question.quality.status === "review" && usableOptions(question).length >= OPTION_COUNT
    );
    const pool = readyQuestions.length >= SESSION_SIZE ? readyQuestions : readyQuestions.concat(fallbackQuestions);
    const questions = shuffle(pool).slice(0, SESSION_SIZE).map(prepareQuestion);

    this.setData({
      mode: "quiz",
      currentIndex: 0,
      currentNumber: questions.length ? 1 : 0,
      sessionTotal: questions.length,
      isLastQuestion: questions.length <= 1,
      currentQuestion: questions[0] || null,
      questions,
      answers: [],
      stats: statsStore.getStats()
    });
  },

  selectOption(event) {
    const key = event.currentTarget.dataset.key;
    const currentQuestion = markSelected(this.data.currentQuestion, key);
    const selectedOption = currentQuestion.options.find((option) => option.key === key);
    const answers = this.data.answers.slice();

    answers[this.data.currentIndex] = {
      questionId: currentQuestion.id,
      selectedKey: key,
      versionId: selectedOption.versionId
    };

    this.setData({ currentQuestion, answers });
  },

  nextQuestion() {
    if (!this.data.answers[this.data.currentIndex]) {
      wx.showToast({ title: "先选一个版本", icon: "none" });
      return;
    }

    const nextIndex = this.data.currentIndex + 1;
    if (nextIndex >= this.data.questions.length) {
      const stats = statsStore.recordSession(this.data.answers);
      this.setData({ mode: "result", stats });
      return;
    }

    this.setData({
      currentIndex: nextIndex,
      currentNumber: nextIndex + 1,
      isLastQuestion: nextIndex === this.data.questions.length - 1,
      currentQuestion: this.data.questions[nextIndex]
    });
  },

  copyStats() {
    wx.setClipboardData({
      data: statsStore.exportStats(),
      success: () => wx.showToast({ title: "已复制统计", icon: "success" })
    });
  },

  clearStats() {
    const stats = statsStore.clearStats();
    this.setData({ stats });
    wx.showToast({ title: "已清空", icon: "none" });
  },

  onShareAppMessage() {
    return {
      title: "中年的百年孤独：译本盲选",
      path: "/pages/quiz/index"
    };
  }
});

function isUsableQuestion(question) {
  return question.quality.status === "ready" && usableOptions(question).length >= OPTION_COUNT;
}

function usableOptions(question) {
  const usableIds = question.quality.usableVersionIds || [];
  return question.options.filter((option) => option.status === "aligned" && usableIds.includes(option.versionId));
}

function prepareQuestion(question) {
  const options = shuffle(usableOptions(question)).slice(0, OPTION_COUNT).map((option, index) => ({
    key: `${question.id}-${index}`,
    label: LABELS[index],
    text: option.text,
    versionId: option.versionId,
    selected: false
  }));

  return {
    id: question.id,
    chapterOrder: question.chapterOrder,
    cue: question.cue,
    highlightCount: question.highlightCount,
    quality: question.quality,
    options
  };
}

function markSelected(question, selectedKey) {
  return {
    ...question,
    options: question.options.map((option) => ({
      ...option,
      selected: option.key === selectedKey
    }))
  };
}

function shuffle(items) {
  const output = items.slice();
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }
  return output;
}
