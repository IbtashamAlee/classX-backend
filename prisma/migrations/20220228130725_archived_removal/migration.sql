/*
  Warnings:

  - You are about to drop the column `archivedAt` on the `Chat` table. All the data in the column will be lost.
  - You are about to drop the column `archivedAt` on the `Class` table. All the data in the column will be lost.
  - You are about to drop the column `archivedAt` on the `Department` table. All the data in the column will be lost.
  - You are about to drop the column `archivedAt` on the `Institute` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Chat" DROP COLUMN "archivedAt";

-- AlterTable
ALTER TABLE "Class" DROP COLUMN "archivedAt";

-- AlterTable
ALTER TABLE "Department" DROP COLUMN "archivedAt";

-- AlterTable
ALTER TABLE "Institute" DROP COLUMN "archivedAt";
