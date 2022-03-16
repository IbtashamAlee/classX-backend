/*
  Warnings:

  - You are about to alter the column `code` on the `Class` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(16)`.
  - A unique constraint covering the columns `[code]` on the table `Class` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Class" ALTER COLUMN "code" SET DATA TYPE VARCHAR(16);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailTokenGen" TIMESTAMPTZ(6),
ADD COLUMN     "resetTokenGen" TIMESTAMPTZ(6);

-- CreateIndex
CREATE UNIQUE INDEX "Class_code_key" ON "Class"("code");
