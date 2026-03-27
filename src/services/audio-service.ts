import { prisma } from '../lib/prisma.js';

export interface AudioFileData {
  title: string;
  description?: string;
  fileId: string;
  duration?: number;
  fileSize?: number;
  mimeType?: string;
  category?: string;
}

export async function createAudioFile(data: AudioFileData) {
  return await prisma.audioFile.create({
    data: {
      title: data.title,
      description: data.description,
      fileId: data.fileId,
      duration: data.duration,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      category: data.category,
    },
  });
}

export async function findAudioByFileId(fileId: string, category?: string) {
  return await prisma.audioFile.findFirst({
    where: {
      fileId,
      ...(category ? { category } : {}),
    },
  });
}

export async function getActiveAudioFiles(category?: string) {
  const where: any = { isActive: true };
  if (category) {
    where.category = category;
  }

  return await prisma.audioFile.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getAllAudioFiles() {
  return await prisma.audioFile.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

export async function getAudioFileById(id: string) {
  return await prisma.audioFile.findUnique({
    where: { id },
  });
}

export async function updateAudioFile(id: string, data: Partial<AudioFileData & { isActive?: boolean }>) {
  return await prisma.audioFile.update({
    where: { id },
    data,
  });
}

export async function deleteAudioFile(id: string) {
  return await prisma.audioFile.delete({
    where: { id },
  });
}

export async function toggleAudioFileStatus(id: string) {
  const audioFile = await prisma.audioFile.findUnique({
    where: { id },
  });

  if (!audioFile) {
    throw new Error('Audio file not found');
  }

  return await prisma.audioFile.update({
    where: { id },
    data: { isActive: !audioFile.isActive },
  });
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}
