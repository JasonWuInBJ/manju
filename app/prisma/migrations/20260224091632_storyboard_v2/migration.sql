/*
  Warnings:

  - You are about to drop the column `camera` on the `Shot` table. All the data in the column will be lost.
  - You are about to drop the column `character` on the `Shot` table. All the data in the column will be lost.
  - You are about to drop the column `lighting` on the `Shot` table. All the data in the column will be lost.
  - You are about to drop the column `scene` on the `Shot` table. All the data in the column will be lost.
  - Added the required column `cameraMovement` to the `Shot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cameraShotType` to the `Shot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `duration` to the `Shot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sceneSetting` to the `Shot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `visualPrompt` to the `Shot` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Character" ADD COLUMN "imageTaskId" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "defaultNegativePrompt" TEXT;

-- AlterTable
ALTER TABLE "Script" ADD COLUMN "novelText" TEXT;

-- CreateTable
CREATE TABLE "Episode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scriptIds" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Episode_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VideoAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT,
    "taskId" TEXT,
    "duration" INTEGER,
    "aspectRatio" TEXT,
    "prompt" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VideoAsset_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GlobalConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "glmApiKey" TEXT,
    "glmApiUrl" TEXT DEFAULT 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    "anthropicApiKey" TEXT,
    "anthropicApiUrl" TEXT DEFAULT 'https://api.anthropic.com',
    "runningHubApiKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Shot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scriptId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "cameraShotType" TEXT NOT NULL,
    "cameraMovement" TEXT NOT NULL,
    "sceneSetting" TEXT NOT NULL,
    "characterAction" TEXT,
    "visualPrompt" TEXT NOT NULL,
    "negativePrompt" TEXT,
    "refCharacterIds" TEXT,
    "audio" TEXT NOT NULL,
    CONSTRAINT "Shot_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Shot" ("audio", "id", "order", "scriptId") SELECT "audio", "id", "order", "scriptId" FROM "Shot";
DROP TABLE "Shot";
ALTER TABLE "new_Shot" RENAME TO "Shot";
CREATE TABLE "new_Video" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "episodeId" TEXT,
    "scriptId" TEXT,
    "name" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "startTime" REAL,
    "endTime" REAL,
    "prompt" TEXT,
    "selectedCharacterIds" TEXT,
    "selectedSceneIds" TEXT,
    "selectedShotIds" TEXT,
    "compositeImageUrl" TEXT,
    "compositeImageTaskId" TEXT,
    "videoUrl" TEXT,
    "videoTaskId" TEXT,
    "videoPrompt" TEXT,
    "storyboardImageBase64" TEXT,
    "storyboardUrl" TEXT,
    "storyboardTaskId" TEXT,
    "layoutType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Video_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Video_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Video_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Video" ("compositeImageTaskId", "compositeImageUrl", "createdAt", "id", "layoutType", "projectId", "scriptId", "selectedCharacterIds", "selectedSceneIds", "storyboardImageBase64", "storyboardTaskId", "storyboardUrl", "updatedAt", "videoPrompt", "videoTaskId", "videoUrl") SELECT "compositeImageTaskId", "compositeImageUrl", "createdAt", "id", "layoutType", "projectId", "scriptId", "selectedCharacterIds", "selectedSceneIds", "storyboardImageBase64", "storyboardTaskId", "storyboardUrl", "updatedAt", "videoPrompt", "videoTaskId", "videoUrl" FROM "Video";
DROP TABLE "Video";
ALTER TABLE "new_Video" RENAME TO "Video";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
