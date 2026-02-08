import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// Supabase env-var usage removed; keep service as a no-op when not explicitly wired

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private client: any | null = null;
  private _isConfigured = false;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    // Supabase env-vars removed; keep the service unconfigured by default.
    this._isConfigured = false;
    this.logger.debug('Supabase integration disabled (env-vars removed)');
  }

  /** Whether the Supabase client is configured and ready */
  get isConfigured(): boolean {
    return this._isConfigured;
  }

  /** Get the raw Supabase client (null when not configured) */
  getClient(): any | null {
    return this.client;
  }

  // ──────────────────────────────────────────────────────────
  // Auth helpers – all are no-ops when Supabase is not configured
  // ──────────────────────────────────────────────────────────

  /**
   * Create a Supabase Auth user and return the Auth UID.
   * Falls back to `null` if Supabase is not configured or the call fails.
   */
  async createAuthUser(
    email: string,
    password: string,
    metadata?: Record<string, any>,
  ): Promise<string | null> {
    if (!this.client) return null;

    try {
      const { data, error } = await this.client.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm for our app flow
        user_metadata: metadata ?? {},
      });

      if (error) {
        this.logger.warn(`Supabase Auth createUser failed: ${error.message}`);
        return null;
      }

      this.logger.log(`Supabase Auth user created: ${data.user.id}`);
      return data.user.id;
    } catch (err) {
      this.logger.error(
        `Supabase Auth createUser error: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Find a Supabase Auth user by email.
   * Returns the Auth UID or null.
   */
  async findAuthUserByEmail(email: string): Promise<string | null> {
    if (!this.client) return null;

    try {
      // list users filtering by email (admin API)
      const { data, error } = await this.client.auth.admin.listUsers({
        page: 1,
        perPage: 1,
      });

      if (error) {
        this.logger.warn(`Supabase Auth listUsers failed: ${error.message}`);
        return null;
      }

      const user = data.users.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase(),
      );
      return user?.id ?? null;
    } catch (err) {
      this.logger.error(
        `Supabase Auth findByEmail error: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Delete a Supabase Auth user by UID.
   */
  async deleteAuthUser(uid: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      const { error } = await this.client.auth.admin.deleteUser(uid);
      if (error) {
        this.logger.warn(`Supabase Auth deleteUser failed: ${error.message}`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.error(
        `Supabase Auth deleteUser error: ${(err as Error).message}`,
      );
      return false;
    }
  }

  // ──────────────────────────────────────────────────────────
  // Data-sync helper – upsert a row into a Supabase table
  // ──────────────────────────────────────────────────────────

  async upsertRow(
    table: string,
    row: Record<string, any>,
    conflictColumn = 'id',
  ): Promise<boolean> {
    if (!this.client) return false;

    try {
      const { error } = await this.client
        .from(table)
        .upsert(row, { onConflict: conflictColumn });
      if (error) {
        this.logger.warn(`Supabase upsert ${table} failed: ${error.message}`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.error(
        `Supabase upsert ${table} error: ${(err as Error).message}`,
      );
      return false;
    }
  }
}
