import { prisma } from '../lib/prisma.js';

export interface MediaFileData {
  title: string;
  description?: string;
  url: string;
  type: 'photo' | 'video';
  fileSize?: number;
  mimeType?: string;
  category?: string;
}

export async function createMediaFile(data: MediaFileData) {
  return await prisma.mediaFile.create({
    data: {
      title: data.title,
      description: data.description,
      url: data.url,
      type: data.type,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      category: data.category,
      isActive: true
    }
  });
}

export async function getActiveMediaFiles(category?: string) {
  const where: any = { isActive: true };
  if (category) {
    where.category = category;
  }
  
  return await prisma.mediaFile.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  });
}

export async function getAllMediaFiles() {
  return await prisma.mediaFile.findMany({
    orderBy: { createdAt: 'desc' }
  });
}

export async function getMediaFileById(id: string) {
  return await prisma.mediaFile.findUnique({
    where: { id }
  });
}

export async function getMediaFilesByType(type: 'photo' | 'video', category?: string) {
  const where: any = { isActive: true, type };
  if (category) {
    where.category = category;
  }
  
  return await prisma.mediaFile.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  });
}

