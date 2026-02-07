/**
 * Supabase Database Types
 * 
 * This file can be auto-generated from your Supabase schema.
 * 
 * To generate types:
 * 1. Install Supabase CLI: npm install -g supabase
 * 2. Run: npx supabase gen types typescript --project-id your-project-id > src/lib/supabase/types.ts
 * 
 * For now, this is a placeholder. Update with your actual database schema types.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      // Add your table definitions here
      // Example:
      // products: {
      //   Row: {
      //     id: string;
      //     name: string;
      //     created_at: string;
      //   };
      //   Insert: {
      //     id?: string;
      //     name: string;
      //     created_at?: string;
      //   };
      //   Update: {
      //     id?: string;
      //     name?: string;
      //     created_at?: string;
      //   };
      // };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
