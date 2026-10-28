"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import AppHeader from "@/src/components/AppHeader";
import { supabase } from "@/src/lib/supabaseClient";
import { useVocabularyBookStore } from "@/src/stores/useVocabularyBookStore";
import type { VocabularyBookWordWithWord } from "@/src/types/vocabulary";
import { createVocabularyBookForUser } from "@/src/utils/vocabularyBook";
import { getJlptDatabaseTag } from "@/src/utils/word";
import sharedStyles from "../shared.module.css";
import {
  createCandidateFromVocabularyBookWord,
  createCandidateFromWord,
  createQuizQuestions,
  type QuizCandidate,
} from "./quizChoice";
import QuizQuestionScene from "./QuizQuestionScene";
import QuizResultScene from "./QuizResultScene";
import QuizSetupScene from "./QuizSetupScene";
import type {
  ApplyQuizResultResult,
  QuizAnswer,
  QuizQuestion,
  QuizResultApplyMode,
  QuizScene,
  QuizSetup,
} from "./quizTypes";
import styles from "./quiz.module.css";

type QuizClientProps = {
  initialVocabularyBookId?: string | null;
};

const initialQuizSetup: QuizSetup = {
  sourceType: "vocabularyBook",
  vocabularyBookId: null,
  level: "N5",
  questionCount: 20,
  questionMode: "random",
};

// 퀴즈 설정에 맞게 단어장 또는 전체 단어에서 후보 단어를 가져옵니다.
async function fetchQuizCandidates(quizSetup: QuizSetup) {
  if (quizSetup.sourceType === "vocabularyBook") {
    if (!quizSetup.vocabularyBookId) {
      return { candidates: [], errorMessage: "퀴즈를 시작할 단어장을 선택해 주세요." };
    }

    const { data, error } = await supabase
      .from("vocabulary_book_words")
      .select("id,book_id,word_id,status,correct_count,wrong_count,created_at,last_quizzed_at,words(*)")
      .eq("book_id", quizSetup.vocabularyBookId)
      .or("status.is.null,status.eq.false")
      .order("wrong_count", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) {
      return { candidates: [], errorMessage: `단어장 단어를 불러오지 못했습니다. ${error.message}` };
    }

    return {
      candidates: ((data ?? []) as VocabularyBookWordWithWord[])
        .map(createCandidateFromVocabularyBookWord)
        .filter((candidate): candidate is QuizCandidate => Boolean(candidate)),
      errorMessage: "",
    };
  }

  const databaseTag = getJlptDatabaseTag(quizSetup.level);
  const { data, error } = await supabase.rpc("get_random_quiz_words", {
    requested_tag: databaseTag ?? null,
    requested_count: quizSetup.questionCount,
  });

  if (error) {
    return { candidates: [], errorMessage: `전체 단어를 불러오지 못했습니다. ${error.message}` };
  }

  return {
    candidates: (data ?? []).map(createCandidateFromWord),
    errorMessage: "",
  };
}

// 전체 단어 목록에서 퀴즈 선택지 후보를 불러옵니다.
async function fetchQuizChoiceCandidates() {
  const wordsPerPage = 1000;
  const choiceCandidates: QuizCandidate[] = [];
  let firstWordIndex = 0;

  while (true) {
    const { data, error } = await supabase
      .from("words")
      .select("*")
      .order("id", { ascending: true })
      .range(firstWordIndex, firstWordIndex + wordsPerPage - 1);

    if (error) {
      return { choiceCandidates: [], errorMessage: `선택지 후보 단어를 불러오지 못했습니다. ${error.message}` };
    }

    choiceCandidates.push(...(data ?? []).map(createCandidateFromWord));

    if (!data || data.length < wordsPerPage) {
      return { choiceCandidates, errorMessage: "" };
    }

    firstWordIndex += wordsPerPage;
  }
}

// 쿼리 문자열로 전달된 단어장 id를 초기 설정값에 반영합니다.
function createInitialQuizSetup(initialVocabularyBookId: string | null): QuizSetup {
  return {
    ...initialQuizSetup,
    vocabularyBookId: initialVocabularyBookId,
    sourceType: initialVocabularyBookId ? "vocabularyBook" : initialQuizSetup.sourceType,
  };
}

// 단어장 퀴즈 답안을 Supabase RPC로 한 번에 저장하고 반영합니다.
async function saveVocabularyBookQuizResult(
  quizSetup: QuizSetup,
  quizAnswers: QuizAnswer[],
  resultApplyMode: QuizResultApplyMode,
): Promise<string> {
  if (!quizSetup.vocabularyBookId) {
    return "단어장 퀴즈만 결과를 저장할 수 있습니다.";
  }

  const quizAnswerRows = quizAnswers.map((quizAnswer) => ({
    vocabularyBookWordId: quizAnswer.vocabularyBookWordId,
    isCorrect: quizAnswer.isCorrect,
  }));

  const { error } = await supabase.rpc("save_vocabulary_book_quiz_result", {
    requested_vocabulary_book_id: quizSetup.vocabularyBookId,
    quiz_answers: quizAnswerRows,
    result_apply_mode: resultApplyMode,
  });

  if (error) {
    return `퀴즈 결과를 저장하지 못했습니다. 단어별 통계는 변경하지 않았습니다. ${error.message}`;
  }

  return "";
}

// 퀴즈의 세 가지 씬 전환과 풀이 상태를 관리합니다.
export default function QuizClient({ initialVocabularyBookId = null }: QuizClientProps) {
  const router = useRouter();
  const [currentScene, setCurrentScene] = useState<QuizScene>("setup");
  const [quizSetup, setQuizSetup] = useState<QuizSetup>(() => createInitialQuizSetup(initialVocabularyBookId));
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswer[]>([]);
  const [hasCreatedWrongAnswerBook, setHasCreatedWrongAnswerBook] = useState(false);
  const [isCreatingWrongAnswerBook, setIsCreatingWrongAnswerBook] = useState(false);
  const [isPreparingQuiz, setIsPreparingQuiz] = useState(false);
  const [isSavingQuizResult, setIsSavingQuizResult] = useState(false);
  const [hasSavedQuizResult, setHasSavedQuizResult] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [resultFeedbackMessage, setResultFeedbackMessage] = useState("");
  const vocabularyBooks = useVocabularyBookStore((state) => state.vocabularyBooks);
  const addVocabularyBook = useVocabularyBookStore((state) => state.addVocabularyBook);
  const loadVocabularyBooksForUser = useVocabularyBookStore((state) => state.loadVocabularyBooksForUser);

  const selectedVocabularyBookTitle = useMemo(
    () =>
      vocabularyBooks.find((vocabularyBook) => vocabularyBook.id === quizSetup.vocabularyBookId)?.title ??
      null,
    [quizSetup.vocabularyBookId, vocabularyBooks],
  );

  // 설정값을 저장하고 실제 문제를 생성한 뒤 문제 씬으로 이동합니다.
  const handleStartQuiz = async (nextQuizSetup: QuizSetup) => {
    setIsPreparingQuiz(true);
    setErrorMessage("");

    const { candidates, errorMessage: nextErrorMessage } = await fetchQuizCandidates(nextQuizSetup);

    if (nextErrorMessage) {
      setErrorMessage(nextErrorMessage);
      setIsPreparingQuiz(false);
      return;
    }

    if (candidates.length < 2) {
      setErrorMessage("퀴즈를 만들 수 있는 단어가 부족합니다. 최소 2개 이상의 단어가 필요합니다.");
      setIsPreparingQuiz(false);
      return;
    }

    const {
      choiceCandidates,
      errorMessage: choiceCandidateErrorMessage,
    } = await fetchQuizChoiceCandidates();

    if (choiceCandidateErrorMessage) {
      setErrorMessage(choiceCandidateErrorMessage);
      setIsPreparingQuiz(false);
      return;
    }

    if (choiceCandidates.length < 4) {
      setErrorMessage("4지선다 선택지를 만들 수 있는 전체 단어가 부족합니다. 최소 4개 이상의 단어가 필요합니다.");
      setIsPreparingQuiz(false);
      return;
    }

    const nextQuizQuestions = createQuizQuestions(
      candidates,
      choiceCandidates,
      nextQuizSetup.questionMode,
      nextQuizSetup.questionCount,
    );

    if (nextQuizQuestions.length === 0) {
      setErrorMessage("유사도 선택지를 포함한 4지선다 문제를 만들 수 없습니다.");
      setIsPreparingQuiz(false);
      return;
    }

    setQuizSetup(nextQuizSetup);
    setQuizQuestions(nextQuizQuestions);
    setQuizAnswers([]);
    setHasCreatedWrongAnswerBook(false);
    setHasSavedQuizResult(false);
    setResultFeedbackMessage("");
    setCurrentScene("question");
    setIsPreparingQuiz(false);
  };

  // 사용자의 선택 답안을 저장하고 다음 문제 또는 결과 씬으로 이동합니다.
  const handleSubmitAnswer = (quizQuestion: QuizQuestion, selectedAnswer: string) => {
    const nextQuizAnswer: QuizAnswer = {
      wordId: quizQuestion.wordId,
      vocabularyBookWordId: quizQuestion.vocabularyBookWordId,
      expression: quizQuestion.expression,
      selectedAnswer,
      correctAnswer: quizQuestion.correctAnswer,
      isCorrect: selectedAnswer === quizQuestion.correctAnswer,
    };

    setQuizAnswers((currentQuizAnswers) => [...currentQuizAnswers, nextQuizAnswer]);
  };

  // 모든 문제 풀이가 끝나면 결과 씬으로 이동합니다.
  const handleFinishQuiz = () => {
    setCurrentScene("result");
  };

  // 사용자가 선택한 방식으로 퀴즈 결과를 저장하고 단어 상태를 반영합니다.
  const handleApplyQuizResult = async (
    resultApplyMode: QuizResultApplyMode,
  ): Promise<ApplyQuizResultResult> => {
    if (hasSavedQuizResult) {
      setResultFeedbackMessage("이미 저장한 퀴즈 결과입니다.");
      return { didSaveQuizResult: false, shouldOpenCompletionModal: false };
    }

    if (quizSetup.sourceType !== "vocabularyBook") {
      setResultFeedbackMessage("전체 단어 퀴즈는 현재 결과 저장 대상이 아닙니다.");
      return { didSaveQuizResult: false, shouldOpenCompletionModal: false };
    }

    setIsSavingQuizResult(true);
    setResultFeedbackMessage("");

    const saveResultErrorMessage = await saveVocabularyBookQuizResult(quizSetup, quizAnswers, resultApplyMode);

    if (saveResultErrorMessage) {
      setResultFeedbackMessage(saveResultErrorMessage);
      setIsSavingQuizResult(false);
      return { didSaveQuizResult: false, shouldOpenCompletionModal: false };
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await loadVocabularyBooksForUser(user.id, true);
    }

    setResultFeedbackMessage("퀴즈 결과를 저장하고 단어 상태를 반영했습니다.");
    setHasSavedQuizResult(true);
    setIsSavingQuizResult(false);
    return { didSaveQuizResult: true, shouldOpenCompletionModal: true };
  };

  // 전체 단어 퀴즈에서 틀린 단어만 모아 새 단어장을 생성합니다.
  const handleCreateWrongAnswerBook = async () => {
    if (quizSetup.sourceType !== "allWords" || hasCreatedWrongAnswerBook) {
      return;
    }

    const wrongWordIds = Array.from(
      new Set(
        quizAnswers
          .filter((quizAnswer) => !quizAnswer.isCorrect)
          .map((quizAnswer) => quizAnswer.wordId),
      ),
    );

    if (wrongWordIds.length === 0) {
      setResultFeedbackMessage("틀린 문제가 없어 새 단어장을 만들 수 없습니다.");
      return;
    }

    setIsCreatingWrongAnswerBook(true);
    setResultFeedbackMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setResultFeedbackMessage(userError?.message ?? "사용자 정보를 확인하지 못했습니다.");
      setIsCreatingWrongAnswerBook(false);
      return;
    }

    if (user.is_anonymous && wrongWordIds.length > 10) {
      setResultFeedbackMessage("게스트는 단어장당 최대 10단어를 저장할 수 있습니다. 오답이 10개를 초과하여 단어장을 만들 수 없습니다.");
      setIsCreatingWrongAnswerBook(false);
      return;
    }

    const createdDateText = new Date().toLocaleDateString("ko-KR");
    const { data: vocabularyBook, error: vocabularyBookError } = await createVocabularyBookForUser(
      `퀴즈 오답 ${createdDateText}`,
      "전체 단어 퀴즈에서 틀린 단어로 만든 단어장입니다.",
      user.id,
    );

    if (vocabularyBookError) {
      setResultFeedbackMessage(`오답 단어장을 만들지 못했습니다. ${vocabularyBookError.message}`);
      setIsCreatingWrongAnswerBook(false);
      return;
    }

    const { error: vocabularyBookWordsError } = await supabase.from("vocabulary_book_words").insert(
      wrongWordIds.map((wordId) => ({
        book_id: vocabularyBook.id,
        word_id: wordId,
        status: false,
        wrong_count: 1,
      })),
    );

    if (vocabularyBookWordsError) {
      setResultFeedbackMessage(`오답 단어장은 만들었지만 단어를 추가하지 못했습니다. ${vocabularyBookWordsError.message}`);
      addVocabularyBook(vocabularyBook);
      setHasCreatedWrongAnswerBook(true);
      setIsCreatingWrongAnswerBook(false);
      return;
    }

    addVocabularyBook(vocabularyBook);
    await loadVocabularyBooksForUser(user.id, true);
    setHasCreatedWrongAnswerBook(true);
    setIsCreatingWrongAnswerBook(false);
    router.replace("/");
  };

  // 퀴즈 흐름을 초기화하고 설정 씬으로 돌아갑니다.
  const handleResetQuiz = () => {
    setQuizQuestions([]);
    setQuizAnswers([]);
    setErrorMessage("");
    setResultFeedbackMessage("");
    setHasCreatedWrongAnswerBook(false);
    setHasSavedQuizResult(false);
    setIsCreatingWrongAnswerBook(false);
    setCurrentScene("setup");
  };

  return (
    <main className={sharedStyles.contentPage}>
      <AppHeader />
      <section className={sharedStyles.contentShell} aria-labelledby="quiz-title">
        <div className={sharedStyles.heroSection}>
          <p className={sharedStyles.eyebrowText}>Quiz practice</p>
          <h1 id="quiz-title" className={sharedStyles.pageTitle}>
            단어 퀴즈
          </h1>
          <p className={sharedStyles.pageDescription}>
            단어 문제를 풀고 결과를 바탕으로 복습할 단어를 정리합니다.
          </p>
        </div>

        <div className={styles.sceneShell}>
          {errorMessage ? (
            <p className={styles.errorNotice} role="alert">
              {errorMessage}
            </p>
          ) : null}

          {currentScene === "setup" ? (
            <QuizSetupScene
              initialQuizSetup={quizSetup}
              isPreparingQuiz={isPreparingQuiz}
              onStartQuiz={handleStartQuiz}
              vocabularyBooks={vocabularyBooks}
            />
          ) : null}

          {currentScene === "question" ? (
            <QuizQuestionScene
              quizAnswers={quizAnswers}
              quizQuestions={quizQuestions}
              selectedVocabularyBookTitle={selectedVocabularyBookTitle}
              onFinishQuiz={handleFinishQuiz}
              onSubmitAnswer={handleSubmitAnswer}
            />
          ) : null}

          {currentScene === "result" ? (
            <QuizResultScene
              hasCreatedWrongAnswerBook={hasCreatedWrongAnswerBook}
              hasSavedQuizResult={hasSavedQuizResult}
              isCreatingWrongAnswerBook={isCreatingWrongAnswerBook}
              isSavingQuizResult={isSavingQuizResult}
              quizAnswers={quizAnswers}
              quizSetup={quizSetup}
              resultFeedbackMessage={resultFeedbackMessage}
              onApplyQuizResult={handleApplyQuizResult}
              onCreateWrongAnswerBook={handleCreateWrongAnswerBook}
              onResetQuiz={handleResetQuiz}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}
