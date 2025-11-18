import '@fastify/session';

declare module '@fastify/session' {
  interface SessionData {
    authenticated: boolean;
    tokens: {
      access_token: string;
      refresh_token?: string;
      expiry_date?: number;
      token_type: string;
      scope: string;
      id_token?: string;
    };
    user: {
      id: string;
      name: string;
      email: string;
      picture?: string;
      verified_email?: boolean;
      locale?: string;
    };
    loginTime: number;
  }
}