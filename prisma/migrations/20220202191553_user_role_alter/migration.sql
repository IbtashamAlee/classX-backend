/*
  Warnings:

  - A unique constraint covering the columns `[roleId,userId]` on the table `UserRole` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "UserRole_roleId_userId_key" ON "UserRole"("roleId", "userId");
