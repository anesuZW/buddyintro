// Lightweight Database type used by the Supabase JS client.
// Prisma is the source of truth - this just gives the JS client typed
// helpers for tables that are queried directly (e.g. realtime channels).

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          email: string;
          profile_picture: string | null;
          invites_sent: number;
          invites_registered: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["users"]["Row"]> & {
          id: string;
          email: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Row"]>;
      };
      stories: {
        Row: {
          id: string;
          user_id: string;
          media_url: string;
          media_type: "image" | "video";
          voice_note_url: string | null;
          text: string | null;
          status: "draft" | "published" | "expired";
          created_at: string;
          expires_at: string;
          published_at: string | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["stories"]["Row"],
          "id" | "created_at" | "published_at"
        > & { id?: string };
        Update: Partial<Database["public"]["Tables"]["stories"]["Row"]>;
      };
      story_tags: {
        Row: {
          id: string;
          story_id: string;
          tagged_user_id: string | null;
          tagged_external_email: string | null;
          invitation_id: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["story_tags"]["Row"],
          "id" | "created_at"
        > & { id?: string };
        Update: Partial<Database["public"]["Tables"]["story_tags"]["Row"]>;
      };
      messages: {
        Row: {
          id: string;
          sender_id: string;
          receiver_id: string;
          story_reference: string | null;
          message: string;
          created_at: string;
          read_at: string | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["messages"]["Row"],
          "id" | "created_at" | "read_at"
        > & { id?: string };
        Update: Partial<Database["public"]["Tables"]["messages"]["Row"]>;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          actor_id: string | null;
          type: string;
          title: string;
          message: string;
          entity_type: string | null;
          entity_id: string | null;
          is_read: boolean;
          read_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["notifications"]["Row"]> & {
          id?: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Row"]>;
      };
      invitations: {
        Row: {
          id: string;
          email: string;
          invited_by: string;
          invite_token: string;
          registered: boolean;
          registered_user_id: string | null;
          created_at: string;
          accepted_at: string | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["invitations"]["Row"],
          "id" | "created_at" | "accepted_at" | "registered" | "registered_user_id"
        > & { id?: string };
        Update: Partial<Database["public"]["Tables"]["invitations"]["Row"]>;
      };
      posts: {
        Row: {
          id: string;
          user_id: string;
          content: string | null;
          media: string | null;
          created_at: string;
          expires_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["posts"]["Row"], "id" | "created_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["posts"]["Row"]>;
      };
      admin_settings: {
        Row: {
          id: number;
          invite_gate_enabled: boolean;
          required_invites: number;
          story_expiry_hours: number;
          post_expiry_hours: number;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["admin_settings"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["admin_settings"]["Row"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      story_status: "draft" | "published" | "expired";
      media_type: "image" | "video";
    };
  };
};
