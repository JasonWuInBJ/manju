-- AlterTable
ALTER TABLE "Character" ADD COLUMN "characterGroupId" TEXT;
ALTER TABLE "Character" ADD COLUMN "costumeName" TEXT;

-- AlterTable
ALTER TABLE "Shot" ADD COLUMN "refPropIds" TEXT;

-- CreateTable
CREATE TABLE "Prop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "prompt" TEXT,
    "imageUrl" TEXT,
    "imageTaskId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Prop_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
