-- AlterTable
ALTER TABLE "Character" ADD COLUMN "characterVideoTaskId" TEXT;
ALTER TABLE "Character" ADD COLUMN "characterVideoUrl" TEXT;
ALTER TABLE "Character" ADD COLUMN "soraCharacterId" TEXT;

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "scriptId" TEXT,
    "storyboardImageBase64" TEXT,
    "selectedCharacterIds" TEXT,
    "selectedSceneIds" TEXT,
    "layoutType" TEXT,
    "videoUrl" TEXT,
    "videoTaskId" TEXT,
    "videoPrompt" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Video_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Video_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
