// src/utils/file.utils.ts
export const allowedMimeTypes = [
	'image/jpeg',
	'image/jpg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/svg+xml',
]

export function isValidImage(mimeType: string): boolean {
	return allowedMimeTypes.includes(mimeType)
}

export function generateFileName(originalName: string): string {
	const timestamp = Date.now()
	const random = Math.random().toString(36).substring(2, 8)
	const fileExtension = originalName.split('.').pop()
	return `image_${timestamp}_${random}.${fileExtension}`
}

export async function streamToBuffer(
	stream: NodeJS.ReadableStream,
): Promise<Buffer> {
	const chunks: Buffer[] = []

	for await (const chunk of stream) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
	}

	return Buffer.concat(chunks)
}

// Helper para formatar duração
export const formatDuration = (ms: number) => {
	const seconds = Math.floor(ms / 1000)
	const minutes = Math.floor(seconds / 60)
	const hours = Math.floor(minutes / 60)

	if (hours > 0) {
		return `${hours}h ${minutes % 60}m`
	} else if (minutes > 0) {
		return `${minutes}m ${seconds % 60}s`
	} else {
		return `${seconds}s`
	}
}
