export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      jp_phrase: {
        Row: { Character: string | null; Type: string | null; Romaji: string | null; Pronunciation_Hint: string | null };
        Insert: { Character?: string | null; Type?: string | null; Romaji?: string | null; Pronunciation_Hint?: string | null };
        Update: { Character?: string | null; Type?: string | null; Romaji?: string | null; Pronunciation_Hint?: string | null };
        Relationships: [];
      };
      profiles: {
        Row: { id: string; display_name: string; created_at: string | null; updated_at: string | null };
        Insert: { id?: string; display_name: string; created_at?: string | null; updated_at?: string | null };
        Update: { id?: string; display_name?: string; created_at?: string | null; updated_at?: string | null };
        Relationships: [];
      };
      vocabulary_books: {
        Row: { id: string; user_id: string; title: string; description: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; title: string; description?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; user_id?: string; title?: string; description?: string | null; created_at?: string; updated_at?: string };
        Relationships: [{ foreignKeyName: "vocabulary_books_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      vocabulary_book_words: {
        Row: { id: string; book_id: string; word_id: number; status: boolean | null; correct_count: number | null; wrong_count: number | null; created_at: string | null; last_quizzed_at: string | null };
        Insert: { id?: string; book_id: string; word_id: number; status?: boolean | null; correct_count?: number | null; wrong_count?: number | null; created_at?: string | null; last_quizzed_at?: string | null };
        Update: { id?: string; book_id?: string; word_id?: number; status?: boolean | null; correct_count?: number | null; wrong_count?: number | null; created_at?: string | null; last_quizzed_at?: string | null };
        Relationships: [
          { foreignKeyName: "vocabulary_book_words_book_id_fkey"; columns: ["book_id"]; isOneToOne: false; referencedRelation: "vocabulary_books"; referencedColumns: ["id"] },
          { foreignKeyName: "vocabulary_book_words_word_id_fkey"; columns: ["word_id"]; isOneToOne: false; referencedRelation: "words"; referencedColumns: ["id"] },
        ];
      };
      quiz_results: {
        Row: { id: string; user_id: string; vocabulary_book_id: string; total_questions: number; correct_count: number; wrong_count: number; mastered_count: number; accuracy: number; wrong_word_ids: string[]; created_at: string };
        Insert: { id?: string; user_id: string; vocabulary_book_id: string; total_questions: number; correct_count: number; wrong_count: number; mastered_count?: number; accuracy?: number; wrong_word_ids?: string[]; created_at?: string };
        Update: { id?: string; user_id?: string; vocabulary_book_id?: string; total_questions?: number; correct_count?: number; wrong_count?: number; mastered_count?: number; accuracy?: number; wrong_word_ids?: string[]; created_at?: string };
        Relationships: [
          { foreignKeyName: "quiz_results_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
          { foreignKeyName: "quiz_results_vocabulary_book_id_fkey"; columns: ["vocabulary_book_id"]; isOneToOne: false; referencedRelation: "vocabulary_books"; referencedColumns: ["id"] },
        ];
      };
      words: {
        Row: {
          id: number;
          expression: string;
          reading: string | null;
          meaning_ko: string;
          meaning_en: string | null;
          tag: string | null;
          part_of_speech: Database["public"]["Enums"]["words_pos"] | null;
        };
        Insert: {
          id?: never;
          expression: string;
          reading?: string | null;
          meaning_ko: string;
          meaning_en?: string | null;
          tag?: string | null;
          part_of_speech?: Database["public"]["Enums"]["words_pos"] | null;
        };
        Update: {
          id?: never;
          expression?: string;
          reading?: string | null;
          meaning_ko?: string;
          meaning_en?: string | null;
          tag?: string | null;
          part_of_speech?: Database["public"]["Enums"]["words_pos"] | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      initialize_guest_account: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      get_random_quiz_words: {
        Args: {
          requested_tag: string | null;
          requested_count: number;
        };
        Returns: Database["public"]["Tables"]["words"]["Row"][];
      };
      save_vocabulary_book_quiz_result: {
        Args: {
          requested_vocabulary_book_id: string;
          quiz_answers: Json;
          result_apply_mode: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      words_pos:
        | "noun"
        | "verb"
        | "i_adj"
        | "na_adj"
        | "adverb"
        | "particle"
        | "auxiliary"
        | "interjection"
        | "conjunction"
        | "expression"
        | "other";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type WordPartOfSpeech = Database["public"]["Enums"]["words_pos"];
export type WordRow = Database["public"]["Tables"]["words"]["Row"];
export type VocabularyBookRow = Database["public"]["Tables"]["vocabulary_books"]["Row"];
export type VocabularyBookWordRow = Database["public"]["Tables"]["vocabulary_book_words"]["Row"];
export type QuizResultRow = Database["public"]["Tables"]["quiz_results"]["Row"];

export type VocabularyBookWithCount = VocabularyBookRow & { wordCount: number; learnedWordCount: number; learningProgressPercentage: number };
export type VocabularyBookWithLearningRows = VocabularyBookRow & { vocabulary_book_words?: Pick<VocabularyBookWordRow, "status">[] | null };
export type VocabularyBookWordWithWord = VocabularyBookWordRow & { words: WordRow | WordRow[] | null };
