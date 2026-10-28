"use client";

import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { Fragment, type ReactNode } from "react";
import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase, supabaseConfigurationMessage } from "@/src/lib/supabaseClient";
import VocabularyBookPreloader from "./VocabularyBookPreloader";
import GuestAccountGuard from "./GuestAccountGuard";
import { useVocabularyBookStore } from "@/src/stores/useVocabularyBookStore";
import styles from "./AuthGuard.module.css";

type AuthGuardProps = {
  children: ReactNode;
};

// 보호 페이지 접근 전 Supabase 인증 세션을 확인하고 비로그인 사용자를 로그인 페이지로 이동시킵니다.
export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const [isCheckingSession, setIsCheckingSession] = useState(isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const guardMessage = isSupabaseConfigured
    ? errorMessage || "인증 상태를 확인하는 중입니다..."
    : supabaseConfigurationMessage;

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return undefined;
    }

    let isMounted = true;
    let authenticationVersion = 0;

    // 인증 사용자가 바뀌면 이전 사용자의 단어장 상태를 비우고 접근 상태를 갱신합니다.
    const applySession = (nextSession: Session | null) => {
      if (!isMounted) return;
      const store = useVocabularyBookStore.getState();
      const storedUserId = store.loadingUserId ?? store.loadedUserId;
      if (!nextSession || (storedUserId && storedUserId !== nextSession.user.id)) {
        store.resetVocabularyBookState();
      }
      setSession(nextSession);
      setErrorMessage("");
      setIsCheckingSession(false);
      if (!nextSession) router.replace("/login");
    };

    // 현재 브라우저 인증 세션을 확인하고 화면 접근 가능 여부를 갱신합니다.
    const checkSession = async () => {
      const requestVersion = authenticationVersion;
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (requestVersion === authenticationVersion) applySession(data.session);
      } catch {
        if (isMounted && requestVersion === authenticationVersion) {
          setErrorMessage("인증 상태를 확인하지 못했습니다. 다시 시도해 주세요.");
          setIsCheckingSession(false);
        }
      }
    };

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authenticationVersion += 1;
      applySession(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router, retryCount]);

  // 실패한 인증 상태 조회를 다시 실행합니다.
  const handleRetry = () => {
    setErrorMessage("");
    setIsCheckingSession(true);
    setRetryCount((currentCount) => currentCount + 1);
  };

  if (isCheckingSession || !session || errorMessage) {
    return (
      <main className={styles.page} aria-live="polite">
        <div className={styles.card}>
          {guardMessage}
          {errorMessage ? (
            <div className={styles.actions}>
              <button className={styles.actionButton} onClick={handleRetry} type="button">다시 시도</button>
            </div>
          ) : null}
        </div>
      </main>
    );
  }

  const content = (
    <Fragment key={session.user.id}>
      <VocabularyBookPreloader userId={session.user.id} />
      {children}
    </Fragment>
  );

  return session.user.is_anonymous ? (
    <GuestAccountGuard key={session.user.id}>{content}</GuestAccountGuard>
  ) : content;
}
