import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import typescript from "typescript";

const runtimeRequire = createRequire(import.meta.url);

// 실제 TypeScript 모듈을 테스트용 의존성과 함께 실행합니다.
function loadModule(relativePath, dependencies) {
  const source = readFileSync(resolve(relativePath), "utf8");
  const { outputText } = typescript.transpileModule(source, {
    compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2020 },
  });
  const testModule = { exports: {} };
  runInNewContext(outputText, {
    exports: testModule.exports,
    module: testModule,
    require: (name) => dependencies[name] ?? runtimeRequire(name),
  }, { filename: relativePath });
  return testModule.exports;
}

// 응답 순서를 제어할 수 있는 조회 요청과 새 단어장 저장소를 만듭니다.
function createTestStore() {
  const requests = [];
  const supabase = {
    from: () => ({
      select: () => ({
        eq: (_column, userId) => ({
          order: () => new Promise((resolveResponse) => requests.push({ userId, resolveResponse })),
        }),
      }),
    }),
  };
  const { useVocabularyBookStore } = loadModule("src/stores/useVocabularyBookStore.ts", {
    "@/src/lib/supabaseClient": { supabase },
    "@/src/utils/learningProgress": loadModule("src/utils/learningProgress.ts", {}),
  });
  return { store: useVocabularyBookStore, requests };
}

// 사용자 소유의 단어장 응답을 생성합니다.
function createBook(userId, id) {
  return {
    id, user_id: userId, title: id, description: null,
    created_at: "2026-10-28T00:00:00Z", updated_at: "2026-10-28T00:00:00Z",
    vocabulary_book_words: [{ status: true }, { status: false }],
  };
}

test("logout discards an in-flight response", async () => {
  const { store, requests } = createTestStore();
  const pending = store.getState().loadVocabularyBooksForUser("guest-a");
  store.getState().resetVocabularyBookState();
  requests[0].resolveResponse({ data: [createBook("guest-a", "old")], error: null });
  await pending;
  assert.equal(store.getState().vocabularyBooks.length, 0);
  assert.equal(store.getState().loadedUserId, null);
  assert.equal(store.getState().isVocabularyBooksLoading, false);
});

test("switching users ignores the previous user's late response", async () => {
  const { store, requests } = createTestStore();
  const first = store.getState().loadVocabularyBooksForUser("guest-a");
  const second = store.getState().loadVocabularyBooksForUser("member-b");
  assert.equal(requests.length, 2);
  requests[1].resolveResponse({ data: [createBook("member-b", "new")], error: null });
  await second;
  requests[0].resolveResponse({ data: [createBook("guest-a", "old")], error: null });
  await first;
  assert.equal(store.getState().loadedUserId, "member-b");
  assert.equal(store.getState().vocabularyBooks[0].id, "new");
  assert.equal(store.getState().vocabularyBooks[0].learningProgressPercentage, 50);
});

test("same-user requests are deduplicated while loading", async () => {
  const { store, requests } = createTestStore();
  const first = store.getState().loadVocabularyBooksForUser("guest-a");
  await store.getState().loadVocabularyBooksForUser("guest-a");
  assert.equal(requests.length, 1);
  requests[0].resolveResponse({ data: [], error: null });
  await first;
});

test("forced refresh supersedes an older request", async () => {
  const { store, requests } = createTestStore();
  const first = store.getState().loadVocabularyBooksForUser("guest-a");
  const refresh = store.getState().loadVocabularyBooksForUser("guest-a", true);
  requests[1].resolveResponse({ data: [createBook("guest-a", "latest")], error: null });
  await refresh;
  requests[0].resolveResponse({ data: [], error: { message: "old failure" } });
  await first;
  assert.equal(store.getState().vocabularyBooks[0].id, "latest");
  assert.equal(store.getState().errorMessage, "");
});

test("failed loads can be retried without a forced refresh", async () => {
  const { store, requests } = createTestStore();
  const first = store.getState().loadVocabularyBooksForUser("guest-a");
  requests[0].resolveResponse({ data: null, error: { message: "temporary failure" } });
  await first;
  const retry = store.getState().loadVocabularyBooksForUser("guest-a");
  assert.equal(requests.length, 2);
  requests[1].resolveResponse({ data: [], error: null });
  await retry;
  assert.equal(store.getState().loadedUserId, "guest-a");
  assert.equal(store.getState().errorMessage, "");
});
