/*
  Warnings:

  - A unique constraint covering the columns `[token]` on the table `UserSession` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "UserSession_token_key" ON "UserSession"("token");
