// src/types/google-drive.ts
export interface UploadResult {
	fileId: string
	fileName: string
	webViewLink: string
	webContentLink: string
	mimeType: string
	size?: string
}

export interface FileInfo {
	id: string
	name: string
	mimeType: string
	webViewLink: string
	webContentLink: string
	size?: string
	createdTime?: string
	thumbnailLink?: string
}

export interface UploadRequest {
	file: {
		filename: string
		mimetype: string
		file: NodeJS.ReadableStream
		truncated: boolean
	}
}

export interface ListFilesQuery {
	limit?: string
}

export interface FileParams {
	fileId: string
}
