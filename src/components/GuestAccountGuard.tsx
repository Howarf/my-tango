"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/src/lib/supabaseClient";
import styles from "./AuthGuard.module.css";

// 게스트의 초기 데이터 준비가 완료된 뒤에만 학습 화면을 표시합니다.
export default function GuestAccountGuard({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const signOutInProgress = useRef(false);

  useEffect(() => {
    let isMounted = true;

    // 현재 게스트의 초기화를 요청하고 준비 실패 시 재시도 화면을 표시합니다.
    const initializeGuestAccount = async () => {
      try {
        const { error } = await supabase.rpc("initialize_guest_account");
        if (error) throw error;
        if (isMounted) setIsReady(true);
      } catch {
        if (isMounted) setErrorMessage("체험 데이터를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    };

    void initializeGuestAccount();
    return () => { isMounted = false; };
  }, [retryCount]);

  // 새 계정을 만들지 않고 현재 게스트의 초기화를 다시 시도합니다.
  const handleRetry = () => {
    setErrorMessage("");
    setRetryCount((currentCount) => currentCount + 1);
  };

  // 초기화에 실패한 게스트 세션을 종료해 로그인 화면으로 돌아갑니다.
  const handleSignOut = async () => {
    if (signOutInProgress.current) return;
    signOutInProgress.current = true;
    setIsSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
    } catch {
      setErrorMessage("체험을 종료하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      signOutInProgress.current = false;
      setIsSigningOut(false);
    }
  };

  if (isReady) return children;

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <p role={errorMessage ? "alert" : "status"}>
          {errorMessage || "체험 데이터를 준비하는 중입니다..."}
        </p>
        {errorMessage ? (
          <div className={styles.actions}>
            <button className={styles.actionButton} disabled={isSigningOut} onClick={handleRetry} type="button">
              다시 시도
            </button>
            <button className={styles.actionButton} disabled={isSigningOut} onClick={handleSignOut} type="button">
              {isSigningOut ? "종료 중..." : "로그인 화면으로"}
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
