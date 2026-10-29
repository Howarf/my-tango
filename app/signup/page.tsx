"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import PublicOnlyGuard from "@/src/components/PublicOnlyGuard";
import { isSupabaseConfigured, supabase, supabaseConfigurationMessage } from "@/src/lib/supabaseClient";
import sharedStyles from "../shared.module.css";
import styles from "./signup.module.css";

// 사용자가 새 계정을 만들고 프로필을 저장할 수 있는 회원가입 화면을 렌더링합니다.
export default function SignupPage() {
  const router = useRouter();
  const [signupId, setSignupId] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState("");
  const [nickname, setNickname] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // 회원가입 폼 제출을 검증하고 Supabase 계정 및 프로필 생성을 처리합니다.
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (!isSupabaseConfigured) {
      setErrorMessage(supabaseConfigurationMessage);
      return;
    }

    if (!signupId.trim() || !signupPassword || !signupPasswordConfirm) {
      setErrorMessage("아이디, 비밀번호, 비밀번호 확인을 모두 입력해 주세요.");
      return;
    }

    if (signupPassword !== signupPasswordConfirm) {
      setErrorMessage("비밀번호와 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setIsLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: signupId.trim(),
      password: signupPassword,
      options: {
        data: {
          display_name: nickname.trim(),
        },
      },
    });

    if (error) {
      setIsLoading(false);
      setErrorMessage(error.message);
      return;
    }

    const userId = data.user?.id;

    if (typeof userId !== "string" || !userId) {
      setIsLoading(false);
      console.error("회원가입 응답에 유효한 사용자 ID가 없습니다.", {
        hasUser: Boolean(data.user),
        userIdType: typeof userId,
      });
      setErrorMessage(
        "회원가입 계정은 생성되었지만 사용자 정보를 확인하지 못했습니다. 로그인 후 다시 시도해 주세요.",
      );
      return;
    }

    const now = new Date().toISOString();
    const { error: profileUpsertError } = await supabase.from("profiles").upsert(
      {
        id: userId,
        display_name: nickname.trim(),
        created_at: now,
        updated_at: now,
      },
      { onConflict: "id" },
    );

    if (profileUpsertError) {
      setIsLoading(false);
      setErrorMessage(
        `회원가입 계정은 생성되었지만 프로필을 저장하지 못했습니다: ${profileUpsertError.message}`,
      );
      return;
    }

    setIsLoading(false);

    setSignupId("");
    setSignupPassword("");
    setSignupPasswordConfirm("");
    setNickname("");
    router.push("/login");
  };

  return (
    <PublicOnlyGuard>
      <main className={sharedStyles.authPage}>
        <section className={[sharedStyles.authCard, styles.card].join(" ")} aria-labelledby="signup-title">
          <p className={sharedStyles.authEyebrow}>Create account</p>
          <h1 id="signup-title" className={sharedStyles.authTitle}>
            회원가입
          </h1>
          <p className={sharedStyles.authDescription}>
            계정을 만들고 일본어 단어 학습을 준비하세요.
          </p>

          <form className={sharedStyles.authForm} onSubmit={handleSubmit}>
            <label className={sharedStyles.authLabel} htmlFor="signup-id">
              아이디
              <input
                id="signup-id"
                className={sharedStyles.authInput}
                type="email"
                value={signupId}
                onChange={(event) => setSignupId(event.target.value)}
                placeholder="example@email.com"
                autoComplete="email"
              />
            </label>

            <label className={sharedStyles.authLabel} htmlFor="signup-password">
              비밀번호
              <input
                id="signup-password"
                className={sharedStyles.authInput}
                type="password"
                value={signupPassword}
                onChange={(event) => setSignupPassword(event.target.value)}
                placeholder="비밀번호를 입력하세요"
                autoComplete="new-password"
              />
            </label>

            <label className={sharedStyles.authLabel} htmlFor="signup-password-confirm">
              비밀번호 확인
              <input
                id="signup-password-confirm"
                className={sharedStyles.authInput}
                type="password"
                value={signupPasswordConfirm}
                onChange={(event) => setSignupPasswordConfirm(event.target.value)}
                placeholder="비밀번호를 다시 입력하세요"
                autoComplete="new-password"
              />
            </label>

            <label className={sharedStyles.authLabel} htmlFor="nickname">
              닉네임
              <input
                id="nickname"
                className={sharedStyles.authInput}
                type="text"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="표시할 닉네임"
                autoComplete="nickname"
              />
            </label>

            {errorMessage ? <p className={[sharedStyles.formMessage, sharedStyles.errorMessage].join(" ")}>{errorMessage}</p> : null}

            <button className={sharedStyles.primaryButton} type="submit" disabled={isLoading}>
              {isLoading ? "가입 중..." : "회원가입"}
            </button>
          </form>

          <p className={sharedStyles.authHelper}>
            이미 계정이 있나요? <Link href="/login">로그인</Link>
          </p>
        </section>
      </main>
    </PublicOnlyGuard>
  );
}
