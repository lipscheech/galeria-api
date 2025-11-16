import { FileInfo, UploadResult } from './../types/google-drive';
import { Readable } from 'stream';
import { drive_v3, google } from 'googleapis';

export class GoogleDriveService {
  private drive: drive_v3.Drive;
  private folderId: string | undefined;

  constructor() {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || './credentials.json',
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    this.drive = google.drive({
      version: 'v3',
      auth: auth,
    });

    this.folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  }

  async uploadFile(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<UploadResult> {
    try {
      const response = await this.drive.files.create({
        requestBody: {
          name: fileName,
          mimeType: mimeType,
          parents: this.folderId ? [this.folderId] : [],
        },
        media: {
          mimeType: mimeType,
          body: Readable.from(fileBuffer),
        },
        fields: 'id, name, webViewLink, webContentLink, mimeType, size',
      });

      // Tornar o arquivo publicamente acessível
      await this.drive.permissions.create({
        fileId: response.data.id!,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });

      return {
        fileId: response.data.id!,
        fileName: response.data.name!,
        webViewLink: response.data.webViewLink!,
        webContentLink: response.data.webContentLink!,
        mimeType: response.data.mimeType!,
        size: response.data.size || undefined,
      };
    } catch (error) {
      throw new Error(`Erro ao fazer upload: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteFile(fileId: string): Promise<boolean> {
    try {
      await this.drive.files.delete({
        fileId: fileId,
      });
      return true;
    } catch (error) {
      throw new Error(`Erro ao deletar arquivo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getFile(fileId: string): Promise<FileInfo> {
    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        fields: 'id, name, webViewLink, webContentLink, mimeType, size, createdTime',
      });

      return {
        id: response.data.id!,
        name: response.data.name!,
        mimeType: response.data.mimeType!,
        webViewLink: response.data.webViewLink!,
        webContentLink: response.data.webContentLink!,
        size: response.data.size || undefined,
        createdTime: response.data.createdTime || undefined,
      };
    } catch (error) {
      throw new Error(`Erro ao buscar arquivo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listFiles(pageSize: number = 10): Promise<FileInfo[]> {
    try {
      const response = await this.drive.files.list({
        pageSize: pageSize,
        fields: 'files(id, name, mimeType, webViewLink, createdTime, size)',
        orderBy: 'createdTime desc',
      });

      return (response.data.files || []).map((file: any) => ({
        id: file.id!,
        name: file.name!,
        mimeType: file.mimeType!,
        webViewLink: file.webViewLink!,
        webContentLink: file.webContentLink || '',
        size: file.size || undefined,
        createdTime: file.createdTime || undefined,
      }));
    } catch (error) {
      throw new Error(`Erro ao listar arquivos: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const googleDriveService = new GoogleDriveService();