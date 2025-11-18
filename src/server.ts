import { fastifyCors } from '@fastify/cors'
import multipart from '@fastify/multipart'
import { fastifySwagger } from '@fastify/swagger'
import { fastify, FastifyReply, FastifyRequest } from 'fastify'
// Usamos TypeBox para schemas (JSON Schema). Não usar o provedor Zod aqui para evitar
// conflito entre formatos de schema (Zod vs TypeBox).
import fastifyCookie from '@fastify/cookie'
import fastifySession from '@fastify/session'
import { Type } from '@sinclair/typebox'
import {
   CombinedErrorResponseSchema,
   ErrorResponseSchema,
   UploadResponseSchema,
   UserInfoSchema,
} from './schemas/file.schemas.js'
import {
   googleDriveService,
   GoogleDriveService,
} from './services/google-drive.service.js'
import { formatDuration, generateFileName, isValidImage } from './utils/file.utils.js'
import { EncryptionService } from './utils/encryption.js'

// Inicializar Google Auth
const googleAuth = new GoogleDriveService('16jYvRHfQBx93DGe97GapL5kqWKKDYvm4');
const encryptionService = new EncryptionService();
let tokens;

const app = fastify({
   logger: {
      level: 'info',
      transport:
         process.env.NODE_ENV === 'development'
            ? {
               target: 'pino-pretty',
               options: {
                  colorize: true,
                  translateTime: 'HH:MM:ss Z',
                  ignore: 'pid,hostname',
               },
            }
            : undefined,
   },
});

// Registrar @fastify/multipart
const registerPlugins = async () => {
   await app.register(multipart, {
      limits: {
         fileSize: 10 * 1024 * 1024, // 10MB
         files: 1,
      },
      attachFieldsToBody: false,
      throwFileSizeLimit: false,
   });
   await app.register(fastifyCookie)
   await app.register(fastifySession, {
      secret: process.env.SESSION_SECRET || 'session-secret-change-in-production',
      cookie: {
         secure: process.env.NODE_ENV === 'production',
         maxAge: 24 * 60 * 60 * 1000, // 24 horas
         httpOnly: true,
         path: '/',
      },
   });

   app.register(fastifyCors, {
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
   })

   app.register(fastifySwagger, {
      openapi: {
         info: {
            title: 'Galeria API',
            description: 'API documentation for Galeria',
            version: '1.0.0',
         },
      },
      // Sem transform específico — usamos os schemas TypeBox diretamente
   })
}

// Middleware de autenticação
const authenticate = async (
   request: {
      session: {
         authenticated: any
         tokens: { access_token: any }
         destroy: () => void
      }
   },
   reply: {
      status: (arg0: number) => {
         (): any
         new(): any
         send: {
            (arg0: { success: boolean; error: string }): any
            new(): any
         }
      }
   },
) => {
   try {
      if (!request.session.authenticated || !request.session.tokens) {
         return reply.status(401).send({
            success: false,
            error: 'Autenticação necessária. Faça login em /auth/google',
         })
      }

      const isValid = await googleAuth.validateTokens(request.session.tokens)
      if (!isValid) {
         request.session.destroy()
         return reply.status(401).send({
            success: false,
            error: 'Sessão expirada. Faça login novamente',
         })
      }
   } catch (error) {
      app.log.error(`Erro na autenticação: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return reply.status(401).send({
         success: false,
         error: 'Erro de autenticação',
      })
   }
}

// Registrar plugins


// Health check
app.get('/health', async () => {
   return {
      status: 'OK',
      service: 'Google Drive Upload API',
      timestamp: new Date().toISOString(),
   }
})

// Rota de upload de imagem
app.route({
   method: 'POST',
   url: '/upload',
   schema: {
      body: Type.Object({
         filename: Type.String(),
         mimeType: Type.String(),
         data: Type.String(), // base64
      }),
      response: {
         200: UploadResponseSchema,
         400: CombinedErrorResponseSchema,
         500: CombinedErrorResponseSchema,
      },
   },
   handler: async (
      request: FastifyRequest<{
         Body: {
            filename: string
            mimeType: string
            data: string
         }
      }>,
      reply: FastifyReply,
   ) => {
      try {
         const { filename, data } = request.body
         let mimeType: string | undefined = (request.body as any).mimeType

         // Validar tipo de arquivo

            // Agora valide o tipo de arquivo (depois de possivelmente extrair do dataURL)
            if (!mimeType || !isValidImage(mimeType)) {
               return reply.status(400).send({
                  success: false,
                  error: 'Tipo de arquivo não permitido. Use apenas imagens (JPEG, PNG, GIF, WebP, SVG)',
               })
            }

         // Se o cliente enviou uma dataURL (data:image/png;base64,AAAA...),
         // remover o prefixo antes de converter para buffer.
         let base64Data = data
         if (typeof base64Data === 'string' && base64Data.startsWith('data:')) {
            const idx = base64Data.indexOf(',')
            if (idx !== -1) base64Data = base64Data.slice(idx + 1)
            // se o mimeType não foi enviado, tente extrair do dataURL
            if (!mimeType) {
               const m = data.match(/^data:(.*);base64,/) 
               if (m) mimeType = m[1]
            }
         }

         // Converter base64 para buffer
         const buffer = Buffer.from(base64Data, 'base64')

         // Validar tamanho
         if (buffer.length > 10 * 1024 * 1024) {
            return reply.status(400).send({
               success: false,
               error: 'Arquivo muito grande. Tamanho máximo: 10MB',
            })
         }

         // Gerar nome único
         const fileName = generateFileName(filename)

         // Fazer upload para o Google Drive
         const uploadResult = await googleAuth.uploadFile(
            buffer,
            fileName,
            mimeType,
            tokens
         )

         return {
            success: true,
            message: 'Imagem enviada com sucesso',
            data: uploadResult,
         }
      } catch (error) {
         app.log.error(error)
         return reply.status(500).send({
            success: false,
            error: 'Erro interno do servidor',
         })
      }
   },
})

// Rota alternativa de upload que aceita JSON base64
app.route({
   method: 'POST',
   url: '/upload-base64',
   schema: {
      body: Type.Object({
         filename: Type.String(),
         mimeType: Type.String(),
         data: Type.String(), // base64
      }),
      response: {
         200: UploadResponseSchema,
         400: CombinedErrorResponseSchema,
         500: CombinedErrorResponseSchema,
      },
   },
   handler: async (
      request: FastifyRequest<{
         Body: {
            filename: string
            mimeType: string
            data: string
         }
      }>,
      reply: FastifyReply,
   ) => {
      try {
         const { filename, data } = request.body
         let mimeType: string | undefined = (request.body as any).mimeType

         // Validar tipo de arquivo
         if (!isValidImage(mimeType)) {
            return reply.status(400).send({
               success: false,
               error: 'Tipo de arquivo não permitido. Use apenas imagens (JPEG, PNG, GIF, WebP, SVG)',
            })
         }

         // Se o cliente enviou uma dataURL (data:image/png;base64,AAAA...),
         // remover o prefixo antes de converter para buffer.
         let base64Data = data
         if (typeof base64Data === 'string' && base64Data.startsWith('data:')) {
            const idx = base64Data.indexOf(',')
            if (idx !== -1) base64Data = base64Data.slice(idx + 1)
            if (!mimeType) {
               const m = data.match(/^data:(.*);base64,/) 
               if (m) mimeType = m[1]
            }
         }

         // Converter base64 para buffer
         const buffer = Buffer.from(base64Data, 'base64')

         // Validar tamanho
         if (buffer.length > 10 * 1024 * 1024) {
            return reply.status(400).send({
               success: false,
               error: 'Arquivo muito grande. Tamanho máximo: 10MB',
            })
         }

         // Gerar nome único
         const pictureName = generateFileName(filename)
         if (!tokens) {
            return reply.status(401).send({
               success: false,
               error: 'Sessão expirada. Faça login novamente',
            })
         }
         const decryptedTokens = encryptionService.decrypt(tokens);

         // Fazer upload para o Google Drive
         const uploadResult = await googleAuth.uploadFile(
            buffer,
            pictureName,
            mimeType,
            JSON.parse(decryptedTokens)
         )

         return {
            success: true,
            message: 'Imagem enviada com sucesso',
            data: uploadResult,
         }
      } catch (error) {
         console.error('Erro no upload base64:', error)
         return reply.status(500).send({
            success: false,
            error: 'Erro interno do servidor',
         })
      }
   },
})

// Inicialização do servidor
const start = async (): Promise<void> => {
   try {
      await registerPlugins()

      const port = parseInt(process.env.PORT || '3333')
      const host = '0.0.0.0'

      await app.listen({ port, host }).then(() => {
         console.log('🔥 HTTP server running on http://localhost:3333 !')
         console.log('📚 docs available at http://localhost:3333/docs')
         console.log(`Servidor rodando na porta ${port}`)
      })
   } catch (err) {
      app.log.error(err)
      process.exit(1)
   }
}

// Manipulação de graceful shutdown
process.on('SIGINT', async () => {
   app.log.info('Encerrando servidor...')
   await app.close()
   process.exit(0)
})

process.on('SIGTERM', async () => {
   app.log.info('Encerrando servidor...')
   await app.close()
   process.exit(0)
})

// Rota inicial
app.route({
   method: 'GET',
   url: '/',
   schema: {
      response: {
         200: Type.Object({
            message: Type.String(),
            authUrl: Type.String(),
            endpoints: Type.Array(Type.String())
         })
      }
   },
   handler: async () => {
      const authUrl = googleAuth.generateAuthUrl();
      return {
         message: 'Google Cloud Authentication API',
         authUrl: authUrl,
         endpoints: [
            'GET / - Esta página',
            'GET /auth/google - Iniciar autenticação',
            'GET /auth/google/callback - Callback OAuth',
            'GET /dashboard - Dashboard protegido',
            'GET /cloud-projects - Listar projetos',
            'POST /logout - Fazer logout',
            'GET /session-status - Status da sessão'
         ]
      };
   }
});

// Rota de login
app.route({
   method: 'GET',
   url: '/auth/google',
   schema: {
      response: {
         500: ErrorResponseSchema
      }
   },
   handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
         const authUrl = googleAuth.generateAuthUrl();
         reply.redirect(authUrl);
      } catch (error) {
         app.log.error(error);
         return reply.status(500).send({
            success: false,
            error: 'Erro ao gerar URL de autenticação'
         });
      }
   }
});

// Rota de callback
app.route({
   method: 'GET',
   url: '/auth/google/callback',
   schema: {
      querystring: Type.Object({
         code: Type.Optional(Type.String()),
         error: Type.Optional(Type.String())
      }),
      response: {
         400: ErrorResponseSchema,
         500: ErrorResponseSchema
      }
   },
   handler: async (request: FastifyRequest<{
         Querystring: {
            code: string
            error: string
         }
         session: {
            authenticated: boolean
            tokens: any
            user: any
            loginTime: number
         }
      }>, reply: FastifyReply) => {
      try {
         const { code, error } = request.query;

         if (error) {
            return reply.status(400).send({
               success: false,
               error: `Erro do Google: ${error}`
            });
         }

         if (!code) {
            return reply.status(400).send({
               success: false,
               error: 'Código de autorização não fornecido'
            });
         }

         const tokens = await googleAuth.getTokens(code);
         const userInfo = await googleAuth.getUserInfo(tokens);

         // Inicializar sessão de forma segura
         initializeSession(request.session, tokens, userInfo);

         app.log.info(`Usuário autenticado: ${userInfo.email}`);

         reply.redirect('/dashboard');

      } catch (error) {
         app.log.error(`Erro no callback: ${error instanceof Error ? error.message : ''}`);
         return reply.status(500).send({
            success: false,
            error: 'Falha na autenticação com Google'
         });
      }
   }
});

// Rota do dashboard
app.route({
   method: 'GET',
   url: '/dashboard',
   schema: {
      response: {
         200: Type.Object({
            success: Type.Boolean({ default: true }),
            user: UserInfoSchema,
            sessionInfo: Type.Object({
               loginTime: Type.Number(),
               duration: Type.String()
            })
         }),
         401: ErrorResponseSchema,
         500: ErrorResponseSchema
      }
   },
   preHandler: [authenticate],
   handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
         const user = request.session.user;
         const loginTime = request.session.loginTime;
         const duration = formatDuration(Date.now() - loginTime);
         if (request?.session?.tokens) {
            tokens = encryptionService.encrypt(JSON.stringify(request.session.tokens));
         }

         return {
            success: true,
            user: {
               id: user.id,
               name: user.name,
               email: user.email,
               picture: user.picture
            },
            sessionInfo: {
               loginTime: loginTime,
               duration: duration
            }
         };
      } catch (error) {
         app.log.error(error);
         return reply.status(500).send({
            success: false,
            error: 'Erro ao carregar dashboard'
         });
      }
   }
});

// Helper para inicializar sessão de forma segura
const initializeSession = (session: { authenticated: boolean; tokens: any; user: any; loginTime: number }, tokens: any, userInfo: any) => {
   session.authenticated = true;
   session.tokens = tokens;
   session.user = userInfo;
   session.loginTime = Date.now();
};


start()
