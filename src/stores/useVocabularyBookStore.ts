import { create } from "zustand";
import { supabase } from "@/src/lib/supabaseClient";
import type {
  VocabularyBook,
  VocabularyBookWithCount,
  VocabularyBookWithLearningRows,
} from "@/src/types/vocabulary";
import { calculateLearningProgressPercentage } from "@/src/utils/learningProgress";

type VocabularyBookState = {
  vocabularyBooks: VocabularyBookWithCount[];
  loadedUserId: string | null;
  loadingUserId: string | null;
  isVocabularyBooksLoading: boolean;
  errorMessage: string;
};

type VocabularyBookActions = {
  loadVocabularyBooksForUser: (userId: string, shouldForceReload?: boolean) => Promise<void>;
  addVocabularyBook: (vocabularyBook: VocabularyBook) => void;
  removeVocabularyBook: (vocabularyBookId: string) => void;
  updateVocabularyBookAfterWordRemoval: (vocabularyBookId: string, wasLearned: boolean) => void;
  updateVocabularyBookLearningStatus: (vocabularyBookId: string, wasMemorized: boolean, nextStatus: boolean) => void;
  resetVocabularyBookState: () => void;
};

const initialVocabularyBookState: VocabularyBookState = {
  vocabularyBooks: [],
  loadedUserId: null,
  loadingUserId: null,
  isVocabularyBooksLoading: false,
  errorMessage: "",
};

let vocabularyBookRequestVersion = 0;

// Supabase 단어장 행과 연결 행으로 화면에서 사용할 단어장 요약 정보를 만듭니다.
function createVocabularyBookWithCount(vocabularyBook: VocabularyBookWithLearningRows): VocabularyBookWithCount {
  const vocabularyBookWords = vocabularyBook.vocabulary_book_words ?? [];
  const wordCount = vocabularyBookWords.length;
  const learnedWordCount = vocabularyBookWords.filter(
    (vocabularyBookWord) => vocabularyBookWord.status === true,
  ).length;

  return {
    id: vocabularyBook.id,
    user_id: vocabularyBook.user_id,
    title: vocabularyBook.title,
    description: vocabularyBook.description,
    created_at: vocabularyBook.created_at,
    updated_at: vocabularyBook.updated_at,
    wordCount,
    learnedWordCount,
    learningProgressPercentage: calculateLearningProgressPercentage(wordCount, learnedWordCount),
  };
}

// 생성된 단어장 행을 화면에서 사용할 빈 단어장 요약 정보로 변환합니다.
function createEmptyVocabularyBookWithCount(vocabularyBook: VocabularyBook): VocabularyBookWithCount {
  return {
    ...vocabularyBook,
    wordCount: 0,
    learnedWordCount: 0,
    learningProgressPercentage: 0,
  };
}

export const useVocabularyBookStore = create<VocabularyBookState & VocabularyBookActions>((set, get) => ({
  ...initialVocabularyBookState,
  // 현재 로그인한 사용자의 단어장 목록과 학습 진행률을 불러와 저장합니다.
  loadVocabularyBooksForUser: async (userId, shouldForceReload = false) => {
    const { loadedUserId, loadingUserId, isVocabularyBooksLoading } = get();

    if (!shouldForceReload && loadedUserId === userId) {
      return;
    }

    if (isVocabularyBooksLoading && loadingUserId === userId && !shouldForceReload) {
      return;
    }

    const requestVersion = ++vocabularyBookRequestVersion;
    set({
      ...(loadedUserId !== userId ? { vocabularyBooks: [], loadedUserId: null } : {}),
      loadingUserId: userId,
      isVocabularyBooksLoading: true,
      errorMessage: "",
    });

    const { data, error } = await supabase
      .from("vocabulary_books")
      .select("id,user_id,title,description,created_at,updated_at,vocabulary_book_words(status)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (requestVersion !== vocabularyBookRequestVersion) return;

    if (error) {
      set({
        vocabularyBooks: [],
        loadedUserId: null,
        loadingUserId: null,
        isVocabularyBooksLoading: false,
        errorMessage: `단어장 목록을 불러오지 못했습니다: ${error.message}`,
      });
      return;
    }

    set({
      vocabularyBooks: (data ?? []).map((vocabularyBook: VocabularyBookWithLearningRows) =>
        createVocabularyBookWithCount(vocabularyBook),
      ),
      loadedUserId: userId,
      loadingUserId: null,
      isVocabularyBooksLoading: false,
      errorMessage: "",
    });
  },
  // 새로 생성된 단어장을 생성 순서에 맞게 전역 단어장 목록 끝에 추가합니다.
  addVocabularyBook: (vocabularyBook) => {
    set((currentState) => ({
      vocabularyBooks: [...currentState.vocabularyBooks, createEmptyVocabularyBookWithCount(vocabularyBook)],
    }));
  },
  // 삭제된 단어장을 전역 단어장 목록에서 제거합니다.
  removeVocabularyBook: (vocabularyBookId) => {
    set((currentState) => ({
      vocabularyBooks: currentState.vocabularyBooks.filter(
        (vocabularyBook) => vocabularyBook.id !== vocabularyBookId,
      ),
    }));
  },
  // 단어 삭제 후 선택한 단어장의 단어 수와 학습 진행률을 갱신합니다.
  updateVocabularyBookAfterWordRemoval: (vocabularyBookId, wasLearned) => {
    set((currentState) => ({
      vocabularyBooks: currentState.vocabularyBooks.map((vocabularyBook) => {
        if (vocabularyBook.id !== vocabularyBookId) {
          return vocabularyBook;
        }

        const wordCount = Math.max(0, vocabularyBook.wordCount - 1);
        const learnedWordCount = wasLearned
          ? Math.max(0, vocabularyBook.learnedWordCount - 1)
          : vocabularyBook.learnedWordCount;

        return {
          ...vocabularyBook,
          wordCount,
          learnedWordCount,
          learningProgressPercentage: calculateLearningProgressPercentage(wordCount, learnedWordCount),
        };
      }),
    }));
  },
  // 단어 학습 상태 변경 후 선택한 단어장의 학습 완료 수와 진행률을 갱신합니다.
  updateVocabularyBookLearningStatus: (vocabularyBookId, wasMemorized, nextStatus) => {
    set((currentState) => ({
      vocabularyBooks: currentState.vocabularyBooks.map((vocabularyBook) => {
        if (vocabularyBook.id !== vocabularyBookId) {
          return vocabularyBook;
        }

        const learnedWordCount = wasMemorized === nextStatus
          ? vocabularyBook.learnedWordCount
          : vocabularyBook.learnedWordCount + (nextStatus ? 1 : -1);

        return {
          ...vocabularyBook,
          learnedWordCount,
          learningProgressPercentage: calculateLearningProgressPercentage(
            vocabularyBook.wordCount,
            learnedWordCount,
          ),
        };
      }),
    }));
  },
  // 전역 단어장 목록과 로딩 상태를 초기화합니다.
  resetVocabularyBookState: () => {
    vocabularyBookRequestVersion += 1;
    set(initialVocabularyBookState);
  },
}));
