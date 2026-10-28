"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useRef, useState } from "react";
import PublicOnlyGuard from "@/src/components/PublicOnlyGuard";
import { isSupabaseConfigured, supabase, supabaseConfigurationMessage } from "@/src/lib/supabaseClient";
import sharedStyles from "../shared.module.css";
import styles from "./login.module.css";

// 사용자가 Supabase 인증으로 로그인할 수 있는 화면을 렌더링합니다.
export default function LoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGuestLoggingIn, setIsGuestLoggingIn] = useState(false);
  const authenticationInProgress = useRef(false);
  const guestNoticeDialogReference = useRef<HTMLDialogElement>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // 로그인 폼 제출을 검증하고 Supabase 인증 요청을 처리합니다.
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (authenticationInProgress.current) return;
    setErrorMessage("");
    setSuccessMessage("");

    if (!isSupabaseConfigured) {
      setErrorMessage(supabaseConfigurationMessage);
      return;
    }

    if (!loginId.trim() || !loginPassword) {
      setErrorMessage("아이디와 비밀번호를 모두 입력해 주세요.");
      return;
    }

    authenticationInProgress.current = true;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginId.trim(),
        password: loginPassword,
      });
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      setSuccessMessage("로그인에 성공했습니다. 메인 페이지로 이동합니다.");
      router.replace("/");
    } catch {
      setErrorMessage("로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      authenticationInProgress.current = false;
      setIsLoading(false);
    }
  };

  // 게스트 체험을 시작하기 전에 이용 한도와 계정 안내를 표시합니다.
  const handleOpenGuestNotice = () => {
    if (authenticationInProgress.current) return;
    guestNoticeDialogReference.current?.showModal();
  };

  // 로그인 요청 없이 게스트 이용 안내를 닫습니다.
  const handleCloseGuestNotice = () => {
    guestNoticeDialogReference.current?.close();
  };

  // 안내 확인 후 기존 세션을 재사용하거나 새 익명 계정으로 체험을 시작합니다.
  const handleGuestLogin = async () => {
    if (authenticationInProgress.current) return;
    guestNoticeDialogReference.current?.close();
    setErrorMessage("");
    setSuccessMessage("");
    if (!isSupabaseConfigured) {
      setErrorMessage(supabaseConfigurationMessage);
      return;
    }
    authenticationInProgress.current = true;
    setIsGuestLoggingIn(true);
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!data.session) {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) {
          setErrorMessage(error.code === "anonymous_provider_disabled"
            ? "현재 게스트 체험을 이용할 수 없습니다."
            : "게스트 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.");
          return;
        }
      }
      router.replace("/");
    } catch {
      setErrorMessage("게스트 로그인에 실패했습니다. 연결 상태를 확인해 주세요.");
    } finally {
      authenticationInProgress.current = false;
      setIsGuestLoggingIn(false);
    }
  };

  return (
    <PublicOnlyGuard>
      <main className={sharedStyles.authPage}>
        <section className={[sharedStyles.authCard, styles.card].join(" ")} aria-labelledby="login-title">
          <p className={sharedStyles.authEyebrow}>Welcome back</p>
          <h1 id="login-title" className={sharedStyles.authTitle}>
            로그인
          </h1>
          <p className={sharedStyles.authDescription}>
            가입한 아이디와 비밀번호로 My 탄고를 시작하세요.<br/>
            개인 환경에서 로그인 하는걸 권장합니다.
          </p>

          <form className={sharedStyles.authForm} onSubmit={handleSubmit}>
            <label className={sharedStyles.authLabel} htmlFor="login-id">
              아이디
              <input
                id="login-id"
                className={sharedStyles.authInput}
                type="email"
                value={loginId}
                onChange={(event) => setLoginId(event.target.value)}
                placeholder="example@email.com"
                autoComplete="email"
              />
            </label>

            <label className={sharedStyles.authLabel} htmlFor="login-password">
              비밀번호
              <input
                id="login-password"
                className={sharedStyles.authInput}
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                placeholder="비밀번호를 입력하세요"
                autoComplete="current-password"
              />
            </label>

            {errorMessage ? <p className={[sharedStyles.formMessage, sharedStyles.errorMessage].join(" ")}>{errorMessage}</p> : null}
            {successMessage ? (
              <p className={[sharedStyles.formMessage, sharedStyles.successMessage].join(" ")}>{successMessage}</p>
            ) : null}

            <button className={sharedStyles.primaryButton} type="submit" disabled={isLoading || isGuestLoggingIn}>
              {isLoading ? "로그인 중..." : "로그인"}
            </button>
          </form>

          <button
            className={styles.guestButton}
            type="button"
            onClick={handleOpenGuestNotice}
            disabled={isLoading || isGuestLoggingIn}
          >
            {isGuestLoggingIn ? "체험 시작 중..." : "게스트로 시작하기"}
          </button>
          <dialog
            ref={guestNoticeDialogReference}
            className={styles.guestNoticeDialog}
            aria-labelledby="guest-notice-title"
            aria-describedby="guest-notice-description"
          >
            <h2 id="guest-notice-title" className={sharedStyles.modalTitle}>
              게스트 이용 안내
            </h2>
            <p id="guest-notice-description" className={styles.guestNotice}>
              로그아웃하면 게스트 계정에 다시 접속할 수 없습니다.<br />
              게스트 한도: 단어장 3개 · 단어장당 10단어
            </p>
            <div className={styles.guestNoticeActions}>
              <button
                className={sharedStyles.primaryButton}
                type="button"
                onClick={handleGuestLogin}
                disabled={isLoading || isGuestLoggingIn}
              >
                확인
              </button>
              <button className={styles.guestButton} type="button" onClick={handleCloseGuestNotice}>
                취소
              </button>
            </div>
          </dialog>

          <p className={sharedStyles.authHelper}>
            아직 계정이 없나요? <Link href="/signup">회원가입</Link>
          </p>
        </section>
      </main>
    </PublicOnlyGuard>
  );
}
