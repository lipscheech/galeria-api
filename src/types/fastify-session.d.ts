import 'fastify';
import type { FastifySessionObject } from '@fastify/session';

declare module 'fastify' {
  interface FastifyRequest {
    session: FastifySessionObject & {
      authenticated?: boolean;
      tokens?: any;
      tokensEncrypted?: any;
      user?: any;
      loginTime?: number;
    };
  }
}