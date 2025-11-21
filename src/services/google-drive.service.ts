import { FileInfo, UploadResult } from './../types/google-drive.ts'
import { Readable } from 'stream'
import { drive_v3, google } from 'googleapis'
import { GoogleTokens } from '@/models/google-tokens.model.js'

export class GoogleDriveService {
	private drive: drive_v3.Drive
	private folderId: string | undefined
	private clientId: string | undefined
	private clientSecret: string | undefined
	private redirectUri: string | undefined
	private scopes: string[]
	private oauth2Client: any
	// ATRIBUTOS PRIVADOS

	constructor(folderId?: string) {
		this.folderId = folderId
		// Configuração a partir das variáveis de ambiente
		this.clientId = process.env.GOOGLE_CLIENT_ID
		this.clientSecret = process.env.GOOGLE_CLIENT_SECRET
		this.redirectUri = process.env.REDIRECT_URI

		if (!this.clientId || !this.clientSecret) {
			throw new Error(
				'GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET são obrigatórios no .env',
			)
		}

		this.oauth2Client = new google.auth.OAuth2(
			this.clientId,
			this.clientSecret,
			this.redirectUri,
		)

		this.drive = google.drive({ version: 'v3', auth: this.oauth2Client })

		// Escopos para Google Cloud Console
		this.scopes = [
			'https://www.googleapis.com/auth/cloud-platform.read-only',
			'https://www.googleapis.com/auth/userinfo.email',
			'https://www.googleapis.com/auth/userinfo.profile',
		]

		console.log('Google Auth configurado com sucesso')
	}

	async uploadFile(
		fileBuffer: Buffer,
		fileName: string,
		mimeType: string,
		tokens: GoogleTokens,
	): Promise<UploadResult> {
		try {
			this.setAuthTokens(tokens)

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
			})

			// Tornar o arquivo publicamente acessível
			await this.drive.permissions.create({
				fileId: response.data.id!,
				requestBody: {
					role: 'reader',
					type: 'anyone',
				},
			})

			return {
				fileId: response.data.id!,
				fileName: response.data.name!,
				webViewLink: response.data.webViewLink!,
				webContentLink: response.data.webContentLink!,
				mimeType: response.data.mimeType!,
				size: response.data.size || undefined,
			}
		} catch (error) {
			throw new Error(
				`Erro ao fazer upload: ${error instanceof Error ? error.message : 'Unknown error'}`,
			)
		}
	}

	async deleteFile(fileId: string): Promise<boolean> {
		try {
			await this.drive.files.delete({
				fileId: fileId,
			})
			return true
		} catch (error) {
			throw new Error(
				`Erro ao deletar arquivo: ${error instanceof Error ? error.message : 'Unknown error'}`,
			)
		}
	}

	async getFile(fileId: string): Promise<FileInfo> {
		try {
			const response = await this.drive.files.get({
				fileId: fileId,
				fields: 'id, name, webViewLink, webContentLink, mimeType, size, createdTime',
			})

			return {
				id: response.data.id!,
				name: response.data.name!,
				mimeType: response.data.mimeType!,
				webViewLink: response.data.webViewLink!,
				webContentLink: response.data.webContentLink!,
				size: response.data.size || undefined,
				createdTime: response.data.createdTime || undefined,
			}
		} catch (error) {
			throw new Error(
				`Erro ao buscar arquivo: ${error instanceof Error ? error.message : 'Unknown error'}`,
			)
		}
	}

	async listFiles(pageSize: number = 10): Promise<FileInfo[]> {
		try {
			const response = await this.drive.files.list({
				pageSize: pageSize,
				fields: 'files(id, name, mimeType, webViewLink, createdTime, size)',
				orderBy: 'createdTime desc',
			})

			return (response.data.files || []).map((file: any) => ({
				id: file.id!,
				name: file.name!,
				mimeType: file.mimeType!,
				webViewLink: file.webViewLink!,
				webContentLink: file.webContentLink || '',
				size: file.size || undefined,
				createdTime: file.createdTime || undefined,
			}))
		} catch (error) {
			throw new Error(
				`Erro ao listar arquivos: ${error instanceof Error ? error.message : 'Unknown error'}`,
			)
		}
	}

	// Gerar URL de autenticação
	generateAuthUrl() {
		return this.oauth2Client.generateAuthUrl({
			access_type: 'offline',
			scope: this.scopes,
			prompt: 'consent',
			include_granted_scopes: true,
		})
	}

	// Trocar código por tokens
	async getTokens(code: any) {
		try {
			const { tokens } = await this.oauth2Client.getToken(code)
			this.oauth2Client.setCredentials(tokens)
			return tokens
		} catch (error) {
			throw new Error(
				`Erro ao obter tokens: ${error instanceof Error ? error.message : 'Unknown error'}`,
			)
		}
	}

	// Obter informações do usuário
	async getUserInfo(tokens: any) {
		try {
			this.oauth2Client.setCredentials(tokens)
			const oauth2 = google.oauth2({
				version: 'v2',
				auth: this.oauth2Client,
			})

			const userInfo = await oauth2.userinfo.get()
			return userInfo.data
		} catch (error) {
			throw new Error(
				`Erro ao obter informações do usuário: ${error instanceof Error ? error.message : 'Unknown error'}`,
			)
		}
	}

	// Verificar se tokens são válidos
	async validateTokens(tokens: { access_token: any }) {
		try {
			this.oauth2Client.setCredentials(tokens)
			await this.oauth2Client.getTokenInfo(tokens.access_token)
			return true
		} catch (error) {
			return false
		}
	}

	// Refresh token
	async refreshTokens(tokens: any) {
		try {
			this.oauth2Client.setCredentials(tokens)
			const { credentials } = await this.oauth2Client.refreshAccessToken()
			return credentials
		} catch (error) {
			throw new Error(
				`Erro ao renovar tokens: ${error instanceof Error ? error.message : 'Unknown error'}`,
			)
		}
	}

	setAuthTokens(tokens: GoogleTokens): void {
		this.oauth2Client = new google.auth.OAuth2(
			this.clientId,
			this.clientSecret,
			this.redirectUri,
		)

		this.oauth2Client.setCredentials(tokens)
		this.drive = google.drive({ version: 'v3', auth: this.oauth2Client })
	}
}

export const googleDriveService = new GoogleDriveService()
