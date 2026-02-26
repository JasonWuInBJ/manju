-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Scene" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "scriptId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "time" TEXT NOT NULL DEFAULT 'day',
    "mood" TEXT NOT NULL DEFAULT 'neutral',
    "weather" TEXT NOT NULL DEFAULT 'Clear',
    "prompt" TEXT,
    "negativePrompt" TEXT,
    "imageUrl" TEXT,
    "imageTaskId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Scene_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Scene_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Scene" ("createdAt", "description", "id", "imageTaskId", "imageUrl", "mood", "name", "projectId", "prompt", "scriptId", "time", "updatedAt") SELECT "createdAt", "description", "id", "imageTaskId", "imageUrl", "mood", "name", "projectId", "prompt", "scriptId", "time", "updatedAt" FROM "Scene";
DROP TABLE "Scene";
ALTER TABLE "new_Scene" RENAME TO "Scene";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
