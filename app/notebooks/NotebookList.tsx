"use client";

import { useState } from "react";
import type { VocabularyBookWithCount } from "@/src/types/vocabulary";
import sharedStyles from "../shared.module.css";
import styles from "./notebooks.module.css";

type NotebookListProps = {
  vocabularyBooks: VocabularyBookWithCount[];
  selectedVocabularyBookId: string | null;
  onCreateVocabularyBook: () => void;
  onSelectVocabularyBook: (vocabularyBookId: string) => void;
};

// 단어장 목록과 새 단어장 만들기 진입 버튼을 렌더링합니다.
export default function NotebookList({
  vocabularyBooks,
  selectedVocabularyBookId,
  onCreateVocabularyBook,
  onSelectVocabularyBook,
}: NotebookListProps) {
  const [isMobileListCollapsed, setIsMobileListCollapsed] = useState(false);

  // 모바일 단어장 목록의 접힘 상태를 전환합니다.
  const handleToggleMobileList = () => {
    setIsMobileListCollapsed((currentIsMobileListCollapsed) => !currentIsMobileListCollapsed);
  };

  return (
    <section className={[sharedStyles.surfacePanel, styles.panel].join(" ")} aria-label="내 단어장 목록">
      <div className={styles.listHeader}>
        <h2 className={sharedStyles.sectionTitle}>단어장 목록</h2>
        <div className={styles.notebookListHeaderActions}>
          <button
            aria-controls="notebook-list"
            aria-expanded={!isMobileListCollapsed}
            className={styles.mobileListToggleButton}
            onClick={handleToggleMobileList}
            type="button"
          >
            {isMobileListCollapsed ? "펼치기" : "접기"}
          </button>
          <button
            aria-label="새 단어장 만들기"
            title="새 단어장 만들기"
            className={styles.createInlineButton}
            onClick={onCreateVocabularyBook}
            type="button"
          >
            <span className={styles.createNotebookLabel} aria-hidden="true">새 단어장 만들기</span>
            <span className={styles.createNotebookSymbol} aria-hidden="true">+</span>
          </button>
        </div>
      </div>
      <div
        className={styles.notebookListCollapseFrame}
        data-collapsed={isMobileListCollapsed}
      >
        <ul
          className={[sharedStyles.responsiveList, styles.list].join(" ")}
          id="notebook-list"
        >
          {vocabularyBooks.length === 0 ? (
            <li className={styles.emptyListItem}>아직 만든 단어장이 없습니다.</li>
          ) : null}
          {vocabularyBooks.map((vocabularyBook) => (
            <li className={styles.card} key={vocabularyBook.id}>
              <button
                className={`${sharedStyles.interactiveCardButton} ${styles.cardButton} ${selectedVocabularyBookId === vocabularyBook.id ? styles.activeCardButton : ""}`}
                onClick={() => onSelectVocabularyBook(vocabularyBook.id)}
                type="button"
              >
                <div className={styles.cardTitleRow}>
                  <strong>{vocabularyBook.title}</strong>
                  <small>
                    {vocabularyBook.learnedWordCount} / {vocabularyBook.wordCount}개 학습 ·{" "}
                    {vocabularyBook.learningProgressPercentage}%
                  </small>
                </div>
                <span>{vocabularyBook.description ?? "설명 없는 단어장입니다."}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
