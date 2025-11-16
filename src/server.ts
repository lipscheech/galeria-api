import { fastifyCors } from '@fastify/cors'
import multipart from '@fastify/multipart'
import { fastifySwagger } from '@fastify/swagger'
import { fastify, FastifyReply, FastifyRequest } from 'fastify'
import { jsonSchemaTransform, serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod'
import { generateFileName, isValidImage, streamToBuffer } from './utils/file.utils.js'
import { googleDriveService } from './services/google-drive.service.js'
import { ErrorResponseSchema, UploadResponseSchema } from './schemas/file.schemas.js'

const app = fastify({
   logger: {
      level: 'info',
      transport: process.env.NODE_ENV === 'development' ? {
         target: 'pino-pretty',
         options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname'
         }
      } : undefined
   }
}).withTypeProvider<ZodTypeProvider>()

app.setValidatorCompiler(validatorCompiler)
app.setSerializerCompiler(serializerCompiler)

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
   transform: jsonSchemaTransform,
})

// app.register(ScalarApiReference, {
//    routerPrefix: '/docs',
// })

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
}

// Health check
app.get('/health', async () => {
   return {
      status: 'OK',
      service: 'Google Drive Upload API',
      timestamp: new Date().toISOString()
   };
});

// Rota de upload de imagem
app.route({
   method: 'POST',
   url: '/upload',
   schema: {
      response: {
         200: UploadResponseSchema,
         400: ErrorResponseSchema,
         500: ErrorResponseSchema,
      },
   },
   handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
         const data = await request.file();

         if (!data) {
            return reply.status(400).send({
               success: false,
               error: 'Nenhum arquivo enviado'
            });
         }

         // Validar tipo de arquivo
         if (!isValidImage(data.mimetype)) {
            return reply.status(400).send({
               success: false,
               error: 'Tipo de arquivo não permitido. Use apenas imagens (JPEG, PNG, GIF, WebP, SVG)'
            });
         }

         // Validar tamanho do arquivo
         if (data.file.truncated) {
            return reply.status(400).send({
               success: false,
               error: 'Arquivo muito grande. Tamanho máximo: 10MB'
            });
         }

         // Ler o arquivo como buffer
         const buffer = await streamToBuffer(data.file);

         // Gerar nome único
         const fileName = generateFileName(data.filename);

         // Fazer upload para o Google Drive
         const uploadResult = await googleDriveService.uploadFile(
            buffer,
            fileName,
            data.mimetype
         );

         return {
            success: true,
            message: 'Imagem enviada com sucesso',
            data: uploadResult,
         };
      } catch (error) {
         app.log.error(error);
         return reply.status(500).send({
            success: false,
            error: 'Erro interno do servidor'
         });
      }
   },
});

// Rota alternativa de upload que aceita JSON base64
app.route({
  method: 'POST',
  url: '/upload-base64',
  schema: {
    body: Type.Object({
      filename: Type.String(),
      mimeType: Type.String(),
      data: Type.String() // base64
    }),
    response: {
      200: UploadResponseSchema,
      400: ErrorResponseSchema,
      500: ErrorResponseSchema,
    },
  },
  handler: async (request: FastifyRequest<{
    Body: {
      filename: string;
      mimeType: string;
      data: string;
    }
  }>, reply: FastifyReply) => {
    try {
      const { filename, mimeType, data } = request.body;

      // Validar tipo de arquivo
      if (!isValidImage(mimeType)) {
        return reply.status(400).send({
          success: false,
          error: 'Tipo de arquivo não permitido. Use apenas imagens (JPEG, PNG, GIF, WebP, SVG)'
        });
      }

      // Converter base64 para buffer
      const buffer = Buffer.from(data, 'base64');

      // Validar tamanho
      if (buffer.length > 10 * 1024 * 1024) {
        return reply.status(400).send({
          success: false,
          error: 'Arquivo muito grande. Tamanho máximo: 10MB'
        });
      }

      // Gerar nome único
      const fileName = generateFileName(filename);

      // Fazer upload para o Google Drive
      const uploadResult = await googleDriveService.uploadFile(
        buffer,
        fileName,
        mimeType
      );

      return {
        success: true,
        message: 'Imagem enviada com sucesso',
        data: uploadResult,
      };
    } catch (error) {
      console.error('Erro no upload base64:', error);
      return reply.status(500).send({ 
        success: false,
        error: 'Erro interno do servidor' 
      });
    }
  },
});

// Inicialização do servidor
const start = async (): Promise<void> => {
   try {
      await registerPlugins();

      const port = parseInt(process.env.PORT || '3333');
      const host = '0.0.0.0';

      await app.listen({ port, host }).then(() => {
         console.log('🔥 HTTP server running on http://localhost:3333 !')
         console.log('📚 docs available at http://localhost:3333/docs')
         console.log(`Servidor rodando na porta ${port}`);
      });
   } catch (err) {
      app.log.error(err);
      process.exit(1);
   }
};


// Manipulação de graceful shutdown
process.on('SIGINT', async () => {
   app.log.info('Encerrando servidor...');
   await app.close();
   process.exit(0);
});

process.on('SIGTERM', async () => {
   app.log.info('Encerrando servidor...');
   await app.close();
   process.exit(0);
});

app.get('/', (request, reply) => {
   console.log(request.ip)
   console.log(request.ips)
   console.log(request.host)
   console.log(request.protocol)
})

// app.listen({ port: 3333, host: 'localhost' }).then(() => {

// })

start();