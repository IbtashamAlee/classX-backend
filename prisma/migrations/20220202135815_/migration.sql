/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `Permission` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");
