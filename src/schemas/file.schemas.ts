// src/schemas/file.schemas.ts
import { Type } from '@sinclair/typebox';

export const FileParamsSchema = Type.Object({
  fileId: Type.String({ minLength: 1 }),
});

export const ListFilesQuerySchema = Type.Object({
  limit: Type.Optional(Type.String({ pattern: '^[0-9]+$' })),
});

export const UploadResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.String(),
  data: Type.Object({
    fileId: Type.String(),
    fileName: Type.String(),
    webViewLink: Type.String(),
    webContentLink: Type.String(),
    mimeType: Type.String(),
    size: Type.Optional(Type.String()),
  }),
});

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
});

export const FilesListResponseSchema = Type.Object({
  success: Type.Boolean(),
  data: Type.Array(
    Type.Object({
      id: Type.String(),
      name: Type.String(),
      mimeType: Type.String(),
      webViewLink: Type.String(),
      webContentLink: Type.String(),
      size: Type.Optional(Type.String()),
      createdTime: Type.Optional(Type.String()),
    })
  ),
});

export const ErrorResponseSchema = Type.Object({
  success: Type.Boolean(),
  error: Type.String(),
});