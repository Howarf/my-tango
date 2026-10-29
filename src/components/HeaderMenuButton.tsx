"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/src/lib/supabaseClient";
import { useVocabularyBookStore } from "@/src/stores/useVocabularyBookStore";
import styles from "./AppHeader.module.css";

// 헤더의 햄버거 버튼과 메뉴 패널을 렌더링합니다.
export default function HeaderMenuButton() {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ userId: string; displayName: string } | null>(null);
  const [logoutError, setLogoutError] = useState("");
  const logoutInProgress = useRef(false);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);
  const resetVocabularyBookState = useVocabularyBookStore((state) => state.resetVocabularyBookState);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsGuest(session?.user.is_anonymous === true);
      setCurrentUserId(session?.user.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isMenuOpen || !currentUserId) return;
    let isCancelled = false;

    // 현재 로그인한 사용자의 프로필 이름을 메뉴에 표시하기 위해 조회합니다.
    const loadProfile = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", currentUserId)
          .maybeSingle();

        if (!isCancelled) {
          setProfile({ userId: currentUserId, displayName: error ? "" : data?.display_name.trim() ?? "" });
        }
      } catch {
        if (!isCancelled) setProfile({ userId: currentUserId, displayName: "" });
      }
    };

    void loadProfile();
    return () => { isCancelled = true; };
  }, [isMenuOpen, currentUserId]);

  useEffect(() => {
    if (!isMenuOpen) {
      return undefined;
    }

    // 메뉴 바깥 영역을 누르면 열린 메뉴를 닫습니다.
    const handleDocumentPointerDown = (event: globalThis.PointerEvent) => {
      if (menuContainerRef.current?.contains(event.target as Node)) {
        return;
      }

      setIsMenuOpen(false);
    };

    document.addEventListener("pointerdown", handleDocumentPointerDown);

    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
    };
  }, [isMenuOpen]);

  // 햄버거 메뉴 패널의 열림 상태를 반대로 변경합니다.
  const handleToggleMenu = () => {
    setIsMenuOpen((currentIsMenuOpen) => !currentIsMenuOpen);
  };

  // 메뉴 항목 선택 후 햄버거 메뉴 패널을 닫습니다.
  const handleCloseMenu = () => {
    setIsMenuOpen(false);
  };

  // Supabase 인증 세션을 종료하고 로그인 페이지로 이동합니다.
  const handleLogout = async () => {
    if (logoutInProgress.current) return;
    if (isGuest && !window.confirm("체험을 종료하면 현재 게스트 계정에 다시 접속할 수 없습니다. 종료할까요?")) return;
    logoutInProgress.current = true;
    setIsLoggingOut(true);
    setLogoutError("");
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
      resetVocabularyBookState();
      router.replace("/login");
    } catch {
      setLogoutError("로그아웃하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      logoutInProgress.current = false;
      setIsLoggingOut(false);
    }
  };

  return (
    <div className={styles.menuContainer} ref={menuContainerRef}>
      <button
        aria-controls="main-mobile-menu"
        aria-expanded={isMenuOpen}
        aria-label={isMenuOpen ? "메뉴 닫기" : "메뉴 열기"}
        className={styles.menuButton}
        type="button"
        onClick={handleToggleMenu}
      >
        <span />
        <span />
        <span />
      </button>

      <nav
        aria-label="메인 메뉴"
        className={`${styles.panel} ${isMenuOpen ? styles.openPanel : ""}`}
        id="main-mobile-menu"
      >
        <div className={styles.profileRow}>
          <p className={styles.profileName}>
            {(profile?.userId === currentUserId ? profile?.displayName : "") || (isGuest ? "게스트" : "사용자")}
          </p>
          <button
            className={styles.logoutButton}
            disabled={isLoggingOut}
            type="button"
            onClick={handleLogout}
          >
            {isLoggingOut ? "로그아웃 중..." : isGuest ? "체험 종료" : "로그아웃"}
          </button>
        </div>
        {logoutError ? <p className={styles.logoutError} role="alert">{logoutError}</p> : null}
        <Link className={styles.menuLink} href="/" onClick={handleCloseMenu}>
          메인
        </Link>
        <Link className={styles.menuLink} href="/words" onClick={handleCloseMenu}>
          JLPT 단어 보기
        </Link>
        <Link className={styles.menuLink} href="/notebooks" onClick={handleCloseMenu}>
          내 단어장
        </Link>
        <Link className={styles.menuLink} href="/quiz" onClick={handleCloseMenu}>
          퀴즈
        </Link>
        <Link className={styles.menuLink} href="/hiragana" onClick={handleCloseMenu}>
          히라가나
        </Link>
        <Link className={styles.menuLink} href="/katakana" onClick={handleCloseMenu}>
          가타카나
        </Link>
      </nav>
    </div>
  );
}
