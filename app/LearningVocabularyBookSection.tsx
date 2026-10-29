"use client";

import Link from "next/link";
import { useVocabularyBookStore } from "@/src/stores/useVocabularyBookStore";
import sharedStyles from "./shared.module.css";
import styles from "./page.module.css";

// 메인 페이지에서 학습중인 단어장 목록과 진행률을 보여줍니다.
export default function LearningVocabularyBookSection() {
  const learningVocabularyBooks = useVocabularyBookStore((state) => state.vocabularyBooks);
  const loadedUserId = useVocabularyBookStore((state) => state.loadedUserId);
  const isVocabularyBooksLoading = useVocabularyBookStore((state) => state.isVocabularyBooksLoading);
  const errorMessage = useVocabularyBookStore((state) => state.errorMessage);
  const isLoading = isVocabularyBooksLoading || !loadedUserId;
  const hasLearningVocabularyBooks = learningVocabularyBooks.length > 0;
  const hasScrollableList = learningVocabularyBooks.length > 4;

  return (
    <section
      className={[sharedStyles.surfacePanel, styles.panel, styles.learningVocabularyBookPanel].join(" ")}
      aria-labelledby="learning-vocabulary-book-title"
    >
      <div className={styles.listHeader}>
        <h2 id="learning-vocabulary-book-title" className={sharedStyles.sectionTitle}>
          학습중인 단어장
        </h2>
        <span className={sharedStyles.countBadge}>{learningVocabularyBooks.length}개</span>
      </div>

      {isLoading ? <div className={styles.todayWordState}>학습중인 단어장을 불러오는 중입니다...</div> : null}

      {!isLoading && errorMessage ? (
        <div className={styles.todayWordState} role="alert">
          {errorMessage}
        </div>
      ) : null}

      {!isLoading && !errorMessage && !hasLearningVocabularyBooks ? (
        <div className={styles.emptyLearningVocabularyBookState}>
          <Link className={styles.createVocabularyBookButton} href="/notebooks">
            단어장 만들기
          </Link>
        </div>
      ) : null}

      {!isLoading && !errorMessage && hasLearningVocabularyBooks ? (
        <ul
          className={[sharedStyles.responsiveList, styles.learningVocabularyBookList].join(" ")}
          data-has-scroll={hasScrollableList ? "true" : "false"}
        >
          {learningVocabularyBooks.map((learningVocabularyBook) => (
            <li className={styles.learningVocabularyBookItem} key={learningVocabularyBook.id}>
              <div className={styles.learningVocabularyBookCard}>
                <Link
                  className={styles.learningVocabularyBookLink}
                  href={`/notebooks?bookId=${learningVocabularyBook.id}`}
                >
                  <div className={styles.cardTitleRow}>
                    <strong>{learningVocabularyBook.title}</strong>
                    <small>{learningVocabularyBook.learningProgressPercentage}%</small>
                  </div>
                  <span>
                    {learningVocabularyBook.description ?? "설명 없는 단어장입니다."}
                  </span>
                  <div className={styles.learningVocabularyBookMetaRow}>
                    <span>
                      {learningVocabularyBook.learnedWordCount} / {learningVocabularyBook.wordCount}개 학습
                    </span>
                    <span>{learningVocabularyBook.wordCount - learningVocabularyBook.learnedWordCount}개 남음</span>
                  </div>
                  <div className={styles.progressTrack} aria-hidden="true">
                    <div
                      className={styles.progressBar}
                      style={{ width: `${learningVocabularyBook.learningProgressPercentage}%` }}
                    />
                  </div>
                </Link>
                <Link className={styles.quizButton} href={`/quiz?bookId=${learningVocabularyBook.id}`}>
                  퀴즈
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
