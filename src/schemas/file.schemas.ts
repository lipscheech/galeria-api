// src/schemas/file.schemas.ts
import { Type } from '@sinclair/typebox'

export const FileParamsSchema = Type.Object({
	fileId: Type.String({ minLength: 1 }),
})

export const ListFilesQuerySchema = Type.Object({
	limit: Type.Optional(Type.String({ pattern: '^[0-9]+$' })),
})

export const UploadResponseSchema = Type.Object({
	success: Type.Boolean(),
	message: Type.String(),
	data: Type.Object({
		fileId: Type.String(),
		fileName: Type.String(),
		webViewLink: Type.String(),
		webContentLink: Type.String(),
		mimeType: Type.String(),
		base64: Type.Optional(Type.String()),
		size: Type.Optional(Type.String()),
	}),
})

export const FileResponseSchema = Type.Object({
	success: Type.Boolean(),
	data: Type.Object({
		id: Type.String(),
		name: Type.String(),
		mimeType: Type.String(),
		webViewLink: Type.String(),
		webContentLink: Type.String(),
		size: Type.Optional(Type.String()),
		createdTime: Type.Optional(Type.String()),
	}),
})

export const FilesListResponseSchema = Type.Object({
	success: Type.Boolean(),
	data: Type.Array(
		Type.Object({
			id: Type.String(),
			name: Type.String(),
			mimeType: Type.String(),
			webViewLink: Type.String(),
			webContentLink: Type.Optional(Type.String()),
			size: Type.Optional(Type.String()),
			createdTime: Type.Optional(Type.String()),
			thumbnailLink: Type.Optional(Type.String()),
		}),
	),
})

export const ErrorResponseSchema = Type.Object({
	success: Type.Boolean(),
	error: Type.String(),
})

// Também exportamos um esquema que aceita o formato de erro padrão do Fastify
// (statusCode, error, message) para que a serialização de erros de validação
// não falhe quando o body de erro vier no formato padrão.
export const FastifyErrorSchema = Type.Object({
	statusCode: Type.Number(),
	error: Type.String(),
	message: Type.String(),
})

// Schema combinado utilizado para respostas de erro nas rotas. Aceita tanto o
// formato custom ({ success, error }) quanto o formato padrão do Fastify.
// `Type.Union` (anyOf/oneOf) can produce JSON Schema constructs that the
// serializer builder (fast-json-stringify) may not fully support in all
// situations. Para evitar erros de compilação de serialização em rotas que
// retornam erros no formato padrão do Fastify ou no formato custom, usamos
// um schema permissivo aqui.
// Schema permissivo que cobre ambos formatos de erro:
// - Nosso formato custom: { success: boolean, error: string }
// - Formato do Fastify: { statusCode: number, error: string, message: string }
// Usamos um objeto com propriedades opcionais em vez de `Type.Union` para
// garantir compatibilidade com o gerador de serialização.
export const CombinedErrorResponseSchema = Type.Object({
	success: Type.Optional(Type.Boolean()),
	error: Type.Optional(Type.String()),
	statusCode: Type.Optional(Type.Number()),
	message: Type.Optional(Type.String()),
})

export const UserInfoSchema = Type.Object({
	id: Type.String(),
	name: Type.String(),
	email: Type.String(),
	picture: Type.Optional(Type.String()),
})

export const TokensSchema = Type.Object({
	access_token: Type.String(),
	refresh_token: Type.Optional(Type.String()),
	expiry_date: Type.Optional(Type.Number()),
	token_type: Type.String(),
	scope: Type.String(),
	id_token: Type.Optional(Type.String()),
})
